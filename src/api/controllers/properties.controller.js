const db = require('../../config/database');

// --- Helper function to format the database row into the desired nested JSON ---
const formatPropertyResponse = (propertyRow) => {
  if (!propertyRow) return null;

  // Destructure the flat row from the database
  const {
    id, listed_by_id, listing_type, title, heading, description, price, currency, price_per_sqft,
    street, city, state, country, zip_code, latitude, longitude, property_type,
    total_sqft, built_up_sqft, carpet_sqft, plot_sqft, year_built, facing, furnishing,
    parking_type, floor_number, total_floors, availability_status, possession_date,
    maintenance_charges, views, status, seller_name, seller_alt_phone, preferred_contact_time,
    allow_in_app_message, allow_in_app_call, allow_whatsapp, created_at, updated_at,
    media, amenities, badges
  } = propertyRow;

  // Reconstruct the nested JSON structure
  return {
    id,
    listed_by: listed_by_id,
    listing_type,
    title,
    heading,
    description,
    price,
    currency,
    price_per_sqft,
    address: { street, city, state, country, zip_code, latitude, longitude },
    property_type,
    area: { total_sqft, built_up_sqft, carpet_sqft, plot_sqft },
    year_built,
    facing,
    furnishing,
    parking_type,
    floor_info: { floor_number, total_floors },
    availability_status,
    possession_date,
    maintenance_charges,
    amenities: amenities || [], // Default to empty array if null
    badges: badges || [],       // Default to empty array if null
    image_urls: media ? media.filter(m => m.type === 'image').map(m => m.url) : [],
    video_url: media ? (media.find(m => m.type === 'video') || {}).url || null : null,
    views,
    status,
    seller: { name: seller_name, alt_phone: seller_alt_phone, preferred_contact_time },
    contact_preferences: { allow_in_app_message, allow_in_app_call, allow_whatsapp },
    created_at,
    updated_at
  };
};

/**
 * @description Get a single property by its ID, with all related data
 * @route POST /api/v1/properties/details
 */
const getPropertyById = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { id: null, user: null };

  if (!data || !data.id) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request body must contain a "data" object with a property "id".' },
    });
  }
  
  const { id } = data;

  try {
    const query = `
      SELECT
          p.*,
          (SELECT json_agg(json_build_object('url', pm.url, 'type', pm.type)) FROM property_media pm WHERE pm.property_id = p.id) as media,
          (SELECT array_agg(a.name) FROM property_amenities pa JOIN amenities a ON pa.amenity_id = a.id WHERE pa.property_id = p.id) as amenities,
          (SELECT array_agg(b.name) FROM property_badges pb JOIN badges b ON pb.badge_id = b.id WHERE pb.property_id = p.id) as badges
      FROM
          properties p
      WHERE
          p.id = $1;
    `;
    const { rows } = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: responseIdentifier,
        data: { error: 'Property not found.' }
      });
    }

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
 * @description Get a list of all properties with basic filtering and pagination
 * @route GET /api/v1/properties
 */
const getProperties = async (req, res) => {
    const { identifier } = req.body;
    const responseIdentifier = identifier || { id: null, user: null };

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
 * @description Create a new property listing with comprehensive details
 * @route POST /api/v1/properties
 */
const createProperty = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { id: null, user: null };

  if (!data) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request body must contain a "data" object.' },
    });
  }

  const {
    listed_by_id, listing_type, title, heading, description, property_type, price, currency = 'INR',
    price_per_sqft = null, maintenance_charges = null, street, city, state, country = 'India',
    zip_code, latitude = null, longitude = null, total_sqft, built_up_sqft = null, carpet_sqft = null,
    plot_sqft = null, bedrooms, bathrooms, balconies = null, year_built = null, facing = null,
    furnishing = null, parking_type = null, floor_number = null, total_floors = null,
    availability_status = 'Ready to Move', possession_date = null, seller_name, seller_alt_phone = null,
    preferred_contact_time = null, allow_in_app_message = true, allow_in_app_call = false,
    allow_whatsapp = true, amenities = [], badges = [], image_urls = [], video_url = null,
  } = data;

  if (!listed_by_id || !listing_type || !title || !price || !city || !state || !property_type || !total_sqft) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Missing required fields: listed_by_id, listing_type, title, price, city, state, property_type, total_sqft are mandatory.' },
    });
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const propertyInsertQuery = `
      INSERT INTO properties (
        listed_by_id, listing_type, title, heading, description, property_type, price, currency, price_per_sqft,
        maintenance_charges, street, city, state, country, zip_code, latitude, longitude, total_sqft, built_up_sqft,
        carpet_sqft, plot_sqft, bedrooms, bathrooms, balconies, year_built, facing, furnishing, parking_type,
        floor_number, total_floors, availability_status, possession_date, seller_name, seller_alt_phone, preferred_contact_time,
        allow_in_app_message, allow_in_app_call, allow_whatsapp
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38
      ) RETURNING id;
    `;
    const propertyValues = [
      listed_by_id, listing_type, title, heading, description, property_type, price, currency, price_per_sqft,
      maintenance_charges, street, city, state, country, zip_code, latitude, longitude, total_sqft, built_up_sqft,
      carpet_sqft, plot_sqft, bedrooms, bathrooms, balconies, year_built, facing, furnishing, parking_type,
      floor_number, total_floors, availability_status, possession_date, seller_name, seller_alt_phone, preferred_contact_time,
      allow_in_app_message, allow_in_app_call, allow_whatsapp
    ];
    const newProperty = await client.query(propertyInsertQuery, propertyValues);
    const propertyId = newProperty.rows[0].id;

    if (image_urls.length > 0) {
      const mediaInsertQuery = 'INSERT INTO property_media (property_id, url, type) VALUES ($1, $2, $3)';
      for (const url of image_urls) {
        await client.query(mediaInsertQuery, [propertyId, url, 'image']);
      }
    }
    if (video_url) {
      await client.query('INSERT INTO property_media (property_id, url, type) VALUES ($1, $2, $3)', [propertyId, video_url, 'video']);
    }

    if (amenities.length > 0) {
      const amenityInsertQuery = 'INSERT INTO amenities (name) VALUES ($1) ON CONFLICT (name) DO NOTHING';
      for (const name of amenities) {
        await client.query(amenityInsertQuery, [name]);
      }
      const linkAmenityQuery = `
        INSERT INTO property_amenities (property_id, amenity_id)
        SELECT $1, id FROM amenities WHERE name = ANY($2::text[]);
      `;
      await client.query(linkAmenityQuery, [propertyId, amenities]);
    }

    if (badges.length > 0) {
      const badgeInsertQuery = 'INSERT INTO badges (name) VALUES ($1) ON CONFLICT (name) DO NOTHING';
      for (const name of badges) {
        await client.query(badgeInsertQuery, [name]);
      }
      const linkBadgeQuery = `
        INSERT INTO property_badges (property_id, badge_id)
        SELECT $1, id FROM badges WHERE name = ANY($2::text[]);
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

module.exports = {
  createProperty,
  getPropertyById,
  getProperties,
};

