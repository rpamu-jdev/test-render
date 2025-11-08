const db = require('./src/config/database');

// The hardcoded UUID of the user we created in Step 1
const DUMMY_USER_ID = '1f972826-22a7-4f6c-9a28-5b4e7b8a7f9b';

// Array of dummy property data
const propertiesToSeed = [
  {
    listing_type: 'sale',
    title: 'Spacious 2BHK in Gachibowli',
    description: 'A well-lit 2BHK apartment located in the heart of Gachibowli, offering modern amenities and easy access to IT hubs.',
    price: 8500000.00,
    city: 'Hyderabad',
    state: 'Telangana',
    zip_code: '500032',
    property_type: 'Apartment',
    total_sqft: 1250.0,
    bedrooms: 2,
    bathrooms: 2,
    amenities: ['Gym', 'Swimming Pool', 'Lift', 'Security', 'Clubhouse'],
    badges: ['Owner Verified', 'Govt Verified'],
    image_urls: ['https://placehold.co/600x400/EEE/31343C?text=Living+Room', 'https://placehold.co/600x400/EEE/31343C?text=Bedroom']
  },
  {
    listing_type: 'rent',
    title: 'Luxury 4BHK Villa in Jubilee Hills',
    description: 'Experience luxury living in this beautiful 4-bedroom villa with a private garden and premium interiors. Ideal for families.',
    price: 150000.00, // Rent per month
    city: 'Hyderabad',
    state: 'Telangana',
    zip_code: '500033',
    property_type: 'Villa',
    total_sqft: 3200.0,
    bedrooms: 4,
    bathrooms: 4,
    amenities: ['Swimming Pool', 'Clubhouse', 'Security', 'Private Garden', 'Power Backup'],
    badges: ['Premium Listing'],
    image_urls: ['https://placehold.co/600x400/DDD/31343C?text=Villa+Exterior', 'https://placehold.co/600x400/DDD/31343C?text=Master+Bedroom']
  },
  {
    listing_type: 'sale',
    title: '1RK Studio in Ameerpet',
    description: 'A compact and cozy 1RK studio apartment perfect for students or bachelors. Close to the metro station.',
    price: 3500000.00,
    city: 'Hyderabad',
    state: 'Telangana',
    zip_code: '500016',
    property_type: 'Apartment',
    total_sqft: 450.0,
    bedrooms: 1,
    bathrooms: 1,
    amenities: ['Lift', 'Security'],
    badges: [],
    image_urls: ['https://placehold.co/600x400/CCC/31343C?text=Studio+Room']
  },
  {
    listing_type: 'sale',
    title: 'Modern 3BHK in Koramangala',
    description: 'A stylish 3BHK apartment in the bustling neighborhood of Koramangala, Bengaluru. Features a modular kitchen and city views.',
    price: 12500000.00,
    city: 'Bengaluru',
    state: 'Karnataka',
    zip_code: '560095',
    property_type: 'Apartment',
    total_sqft: 1600.0,
    bedrooms: 3,
    bathrooms: 3,
    amenities: ['Gym', 'Lift', 'Security', 'Power Backup'],
    badges: ['Owner Verified'],
    image_urls: ['https://placehold.co/600x400/BBB/31343C?text=Balcony+View']
  }
];

const seedDatabase = async () => {
  console.log('Starting to seed the database...');
  
  for (const propertyData of propertiesToSeed) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const { amenities, badges, image_urls, ...mainData } = propertyData;

      // FIXED: Added 'country' column and made the value insertion more robust
      // to avoid errors from Object.values() having an unpredictable order.
      const propertyInsertQuery = `
        INSERT INTO properties
          (posted_by, listing_type, title, description, price, city, state, zip_code, property_type, total_sqft, bedrooms, bathrooms, country)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id;
      `;
      const propertyValues = [
        DUMMY_USER_ID,
        mainData.listing_type,
        mainData.title,
        mainData.description,
        mainData.price,
        mainData.city,
        mainData.state,
        mainData.zip_code,
        mainData.property_type,
        mainData.total_sqft,
        mainData.bedrooms,
        mainData.bathrooms,
        'India' // Default country value
      ];
      const newProperty = await client.query(propertyInsertQuery, propertyValues);
      const propertyId = newProperty.rows[0].id;

      if (image_urls.length > 0) {
        const mediaInsertQuery = 'INSERT INTO property_media (property_id, url, type) VALUES ($1, $2, $3)';
        for (const url of image_urls) {
          await client.query(mediaInsertQuery, [propertyId, url, 'image']);
        }
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
      console.log(`- Successfully inserted property: "${propertyData.title}"`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`- Failed to insert property "${propertyData.title}":`, error);
    } finally {
      client.release();
    }
  }

  console.log('Database seeding finished.');
  
  // FIXED: Added a check to prevent crash and to provide a helpful hint.
  if (db.pool) {
    db.pool.end();
  } else {
    console.warn(`
      ***************************************************************************************
      WARNING: Could not close database connection automatically.
      The script may not exit.
      Please ensure you have exported 'pool' from your 'src/config/database.js' file.
      ***************************************************************************************
    `);
  }
};

// Wait for the DB connection to be established before running the seed function.
setTimeout(seedDatabase, 2000);

