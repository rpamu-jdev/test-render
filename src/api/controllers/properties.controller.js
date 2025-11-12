const db = require('../../config/database');

/**
 * @description Get a single property by its ID, with all related data
 * @route POST /api/v1/properties/details
 */
const getPropertyById = async (req, res) => {
  const { identifier, data } = req.body;
  const user_id = identifier?.user_id;
  const responseIdentifier = identifier || { request_id: null, user_id: null };

  if (!data || !data.property_id) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request body must contain a "data" object with a property "property_id".' },
    });
  }

  const { property_id } = data;

  // --- Record the view in the background ---
  if (user_id) {
    const recordViewQuery = `
        INSERT INTO user_recently_viewed (user_id, property_id, viewed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, property_id)
        DO UPDATE SET viewed_at = NOW();
    `;
    db.query(recordViewQuery, [user_id, property_id]).catch(err => {
      console.error('Failed to record property view:', err);
    });
  }

  try {
    // --- THIS QUERY IS PERFECT ---
    // It already fetches all columns (p.*) including 'details'
    const query = `
      SELECT
          p.*,
          (SELECT json_agg(json_build_object('url', pm.url, 'type', pm.type)) FROM property_media pm WHERE pm.property_id = p.property_id) as media,
          (SELECT array_agg(a.name) FROM property_amenities pa JOIN amenities a ON pa.amenity_id = a.amenity_id WHERE pa.property_id = p.property_id) as amenities,
          (SELECT array_agg(b.name) FROM property_badges pb JOIN badges b ON pb.badge_id = b.badge_id WHERE pb.property_id = p.property_id) as badges
      FROM
          properties p
      WHERE
          p.property_id = $1;
    `;
    const { rows } = await db.query(query, [property_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: responseIdentifier,
        data: { error: 'Property not found.' }
      });
    }

    // --- USE THE HELPER FUNCTION ---
    // This call flattens the 'details' object
    const formattedProperty = formatPropertyResponse(rows[0]);

    res.status(200).json({
      identifier: responseIdentifier,
      data: formattedProperty
    });

  } catch (error) {
    console.error('Error fetching property by ID:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An error occurred while fetching the property.' }
    });
  }
};

/**
 * --- HELPER FUNCTION ---
 * This function takes the raw property object from the database
 * and flattens the 'details' JSONB column into the top level.
 */
function formatPropertyResponse(property) {
  if (!property) return null;

  // 1. Destructure the 'details' object and all 'rest' of the properties
  const { details, ...rest } = property;

  // 2. Return a new object that spreads:
  //    - All the 'rest' of the properties (id, title, price, media, etc.)
  //    - All the properties from *inside* 'details' (number_of_cabins, etc.)
  return {
    ...rest,
    ...(details || {}) // Use (details || {}) to gracefully handle null details
  };
}


/**
 * @description Get a list of all properties with basic filtering and pagination
 * @route GET /api/v1/properties
 */
const getProperties = async (req, res) => {
    const { identifier } = req.body;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    try {
        const query = 'SELECT id, title, price, city, state, total_sqft, bedrooms, bathrooms FROM properties ORDER BY created_at DESC LIMIT 20;';
        
        const { rows } = await db.query(query);

        res.status(200).json({
            identifier: responseIdentifier,
            data: rows
        });

    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({
            identifier: responseIdentifier,
            data: { error: 'An error occurred while fetching properties.' }
        });
    }
};



/**
 * @description Create a new property listing
 * @route POST /api/v1/properties
 */
const createProperty = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { request_id: null, user_id: null };

  if (!data) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request body must contain a "data" object.' },
    });
  }

  // --- 1. DESTRUCTURE ALL CORE FIELDS ---
  // These are all the fields to store in dedicated columns
  const {
    // Your existing fields
    posted_by, listing_type, title, heading, description, property_type, price, currency = 'INR',
    price_per_sqft = null, maintenance_charges = null, street, city, state, country = 'India',
    zip_code, latitude = null, longitude = null, total_sqft, built_up_sqft = null, carpet_sqft = null,
    plot_sqft = null, bedrooms, bathrooms, balconies = null, year_built = null, facing = null,
    furnishing = null, parking_type = null, floor_number = null, total_floors = null,
    availability_status = 'Ready to Move', possession_date = null, seller_name, seller_alt_phone = null,
    preferred_contact_time = null, allow_in_app_message = true, allow_in_app_call = false,
    allow_whatsapp = true, amenities = [], badges = [], 
    image_urls = [], 
    video_url = null,

    // New fields for new columns
    email = null,
    locality = null,
    sub_locality = null
  } = data;

  // --- 2. VALIDATION ---
  // (Your existing validation)
  if (!posted_by || !listing_type || !title || !price || !city || !state || !property_type || !total_sqft) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Missing required fields: posted_by, listing_type, title, price, city, state, property_type, total_sqft are mandatory.' },
    });
  }

  // --- 3. CREATE THE 'DETAILS' JSONB BUCKET ---
  
  // Copy the entire data payload
  const details = { ...data };

  // Define *all* keys that are stored in dedicated columns.
  // These will be *removed* from the 'details' object.
  const coreFields = [
    'posted_by', 'listing_type', 'title', 'heading', 'description', 'property_type', 'price', 'currency',
    'price_per_sqft', 'maintenance_charges', 'street', 'city', 'state', 'country',
    'zip_code', 'latitude', 'longitude', 'total_sqft', 'built_up_sqft', 'carpet_sqft',
    'plot_sqft', 'bedrooms', 'bathrooms', 'balconies', 'year_built', 'facing',
    'furnishing', 'parking_type', 'floor_number', 'total_floors',
    'availability_status', 'possession_date', 'seller_name', 'seller_alt_phone',
    'preferred_contact_time', 'allow_in_app_message', 'allow_in_app_call',
    'allow_whatsapp', 'amenities', 'badges', 'image_urls', 'video_url', 
    'email', 'locality', 'sub_locality'
  ];

  // Remove all core fields, leaving only the "extra" data
  for (const field of coreFields) {
    delete details[field];
  }

  // 'details' object now contains all other 150+ fields
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

  
    const propertyInsertQuery = `
      INSERT INTO properties (
        posted_by, listing_type, title, heading, description, property_type, price, currency, price_per_sqft,
        maintenance_charges, street, city, state, country, zip_code, latitude, longitude, total_sqft, built_up_sqft,
        carpet_sqft, plot_sqft, bedrooms, bathrooms, balconies, year_built, facing, furnishing, parking_type,
        floor_number, total_floors, availability_status, possession_date, seller_name, seller_alt_phone, preferred_contact_time,
        allow_in_app_message, allow_in_app_call, allow_whatsapp,
        email, locality, sub_locality, details,
        location 
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
        $39, $40, $41, $42,
        ST_MakePoint($43, $44)::geography
      ) RETURNING property_id;
    `;
    

    // Add longitude and latitude to the *end* of the array
    // to match the new $43 and $44 parameters.
    const propertyValues = [
      posted_by, listing_type, title, heading, description, property_type, price, currency, price_per_sqft,
      maintenance_charges, street, city, state, country, zip_code, latitude, longitude, total_sqft, built_up_sqft,
      carpet_sqft, plot_sqft, bedrooms, bathrooms, balconies, year_built, facing, furnishing, parking_type,
      floor_number, total_floors, availability_status, possession_date, seller_name, seller_alt_phone, preferred_contact_time,
      allow_in_app_message, allow_in_app_call, allow_whatsapp,
      email, locality, sub_locality, details,
      longitude, latitude // Add $43 (long) and $44 (lat)
    ];
    
    const newProperty = await client.query(propertyInsertQuery, propertyValues);
    const propertyId = newProperty.rows[0].property_id;

    // --- (No changes below, this logic is all correct) ---

    if (image_urls && image_urls.length > 0) {
      const mediaInsertQuery = 'INSERT INTO property_media (property_id, url, type) VALUES ($1, $2, $3)';
      for (const url of image_urls) {
        await client.query(mediaInsertQuery, [propertyId, url, 'image']);
      }
    }
    if (video_url) {
      await client.query('INSERT INTO property_media (property_id, url, type) VALUES ($1, $2, $3)', [propertyId, video_url, 'video']);
    }

    if (amenities && amenities.length > 0) {
      const amenityInsertQuery = 'INSERT INTO amenities (name) VALUES ($1) ON CONFLICT (name) DO NOTHING';
      for (const name of amenities) {
        await client.query(amenityInsertQuery, [name]);
      }
      const linkAmenityQuery = `
        INSERT INTO property_amenities (property_id, amenity_id)
        SELECT $1, amenity_id FROM amenities WHERE name = ANY($2::text[]);
      `;
      await client.query(linkAmenityQuery, [propertyId, amenities]);
    }

    if (badges && badges.length > 0) {
      const badgeInsertQuery = 'INSERT INTO badges (name) VALUES ($1) ON CONFLICT (name) DO NOTHING';
      for (const name of badges) {
        await client.query(badgeInsertQuery, [name]);
      }
      const linkBadgeQuery = `
        INSERT INTO property_badges (property_id, badge_id)
        SELECT $1, badge_id FROM badges WHERE name = ANY($2::text[]);
      `;
      await client.query(linkBadgeQuery, [propertyId, badges]);
    }

    await client.query('COMMIT');
    
    res.status(201).json({
      identifier: responseIdentifier,
      data: { message: 'Property created successfully', propertyId },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating property:', error);
    
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An error occurred while creating the property.', details: error.message },
    });
  } finally {
    client.release();
  }
};

/**
 * @description Search for properties with dynamic filters and pagination
 * @route POST /api/v1/properties/search
 */
const searchProperties = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { request_id: null, user_id: null };

  if (!data || !data.filters) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request must include "data" object with a "filters" key.' },
    });
  }

  const { filters, pagination = {} } = data;
  const { page = 1, limit = 10 } = pagination;
  const offset = (page - 1) * limit;

  // --- Dynamic Query Builder ---
  let whereClauses = [];
  let queryParams = [];
  let paramIndex = 1;

  // Whitelist of core columns for simple equality checks
  const coreEqualityFields = new Set([
    'posted_by', 'listing_type', 'property_type', 'city', 'state', 'country',
    'zip_code', 'bedrooms', 'bathrooms', 'balconies', 'year_built', 'facing',
    'furnishing', 'parking_type', 'floor_number', 'total_floors',
    'availability_status', 'seller_name', 'email', 'locality', 'sub_locality'
  ]);

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    switch (key) {
      // --- Special Composite Filters ---
      case 'latitude':
        if (filters.longitude && filters.radius_km) {
          // ST_DWithin(geography, point, meters)
          whereClauses.push(`ST_DWithin(location, ST_MakePoint($${paramIndex++}, $${paramIndex++})::geography, $${paramIndex++})`);
          queryParams.push(filters.longitude, filters.latitude, filters.radius_km * 1000);
        }
        // NOTE: No 'break' here is intentional. We want it to fall through
        // to the 'longitude'/'radius_km' block to be skipped.
        
      // --- THIS IS THE FIX ---
      // We add 'latitude' here. If radius_km was missing, 'latitude'
      // will fall through to this block and be safely skipped,
      // preventing it from hitting the 'default' case.
      case 'longitude':
      case 'radius_km':
        // Already handled by 'latitude' block, so we skip
        break;

      // --- Range Filters (Core) ---
      case 'min_price':
        whereClauses.push(`price >= $${paramIndex++}`);
        queryParams.push(value);
        break;
      case 'max_price':
        whereClauses.push(`price <= $${paramIndex++}`);
        queryParams.push(value);
        break;
      case 'min_sqft':
        whereClauses.push(`total_sqft >= $${paramIndex++}`);
        queryParams.push(value);
        break;
      case 'max_sqft':
        whereClauses.push(`total_sqft <= $${paramIndex++}`);
        queryParams.push(value);
        break;

      // --- Text Search Filter (Core) ---
      case 'search_term':
        whereClauses.push(`(title ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`);
        queryParams.push(`%${value}%`, `%${value}%`);
        break;

      // --- Default: Core Equality or JSONB ---
      default:
        if (coreEqualityFields.has(key)) {
          whereClauses.push(`${key} = $${paramIndex++}`);
          queryParams.push(value);
        } else {
          const jsonFilter = {};
          jsonFilter[key] = value;
          
          whereClauses.push(`details @> $${paramIndex++}::jsonb`);
          queryParams.push(JSON.stringify(jsonFilter));
        }
        break;
    }
  }

  // --- (No changes below this line) ---

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    const countQuery = `SELECT COUNT(*) FROM properties ${whereString}`;
    const totalResult = await db.query(countQuery, queryParams);
    const total_items = parseInt(totalResult.rows[0].count, 10);
    const total_pages = Math.ceil(total_items / limit);

    const dataQuery = `
      SELECT 
        property_id, title, price, city, state, locality, sub_locality,
        total_sqft, bedrooms, bathrooms, property_type, latitude, longitude
      FROM properties
      ${whereString}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    
    const finalQueryParams = [...queryParams, limit, offset];
    const { rows } = await db.query(dataQuery, finalQueryParams);

    res.status(200).json({
      identifier: responseIdentifier,
      data: rows,
      pagination: {
        current_page: page,
        total_pages: total_pages,
        total_items: total_items,
        limit: limit,
      },
    });

  } catch (error) {
    console.error('Error searching properties:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An error occurred while searching for properties.' },
    });
  }
};

module.exports = {
  createProperty,
  getPropertyById,
  getProperties,
  searchProperties,
};

