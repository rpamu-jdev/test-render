const db = require('../../config/database');

/**
 * @description Create a new vendor profile
 * @route POST /api/v1/vendors/create
 */
const createVendor = async (req, res) => {
    const { identifier, data } = req.body;
    const { name, contact_name, phone, email, address, about, logo_url, services, portfolio } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    // --- Basic Validation ---
    if (!name || !phone) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: 'Vendor "name" and "phone" are required.' } 
        });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 1. Insert into main 'vendors' table
        const vendorQuery = `
            INSERT INTO vendors (name, contact_name, phone, email, address, about, logo_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING vendor_id;
        `;
        const vendorResult = await client.query(vendorQuery, [name, contact_name, phone, email, address, about, logo_url]);
        const vendorId = vendorResult.rows[0].vendor_id;

        // 2. Link services (assuming 'services' is an array of service IDs [1, 2, 5])
        if (services && services.length > 0) {
            const serviceQuery = 'INSERT INTO vendor_services (vendor_id, service_id) VALUES ($1, $2)';
            for (const serviceId of services) {
                await client.query(serviceQuery, [vendorId, serviceId]);
            }
        }

        // 3. Add portfolio images (assuming 'portfolio' is an array of image URLs)
        if (portfolio && portfolio.length > 0) {
            const portfolioQuery = 'INSERT INTO vendor_portfolio_images (vendor_id, image_url) VALUES ($1, $2)';
            for (const imageUrl of portfolio) {
                await client.query(portfolioQuery, [vendorId, imageUrl]);
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json({ 
            identifier: responseIdentifier, 
            data: { message: "Vendor created successfully", vendor_id: vendorId }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating vendor:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    } finally {
        client.release();
    }
};

/**
 * @description Add a review for a vendor
 * @route POST /api/v1/vendors/reviews/add
 */
const addReview = async (req, res) => {
    const { identifier, data } = req.body;
    // Updated to include user_name, property_id and use string user_id
    const { vendor_id, user_id, user_name, property_id, rating, review_title, review_body } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!vendor_id || !user_id || !user_name || !rating) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"vendor_id", "user_id", "user_name", and "rating" are required.' }
        });
    }

    try {
        // The trigger 'trg_update_vendor_rating' will automatically update the vendor's
        // average_rating and review_count upon this insert.
        const reviewQuery = `
            INSERT INTO vendor_reviews (vendor_id, user_id, user_name, property_id, rating, review_title, review_body)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (vendor_id, user_id, property_id) DO UPDATE SET
                rating = EXCLUDED.rating,
                review_title = EXCLUDED.review_title,
                review_body = EXCLUDED.review_body,
                user_name = EXCLUDED.user_name, -- Also update user_name on conflict
                created_at = NOW();
        `;
        // Pass property_id as null if it's not provided
        await db.query(reviewQuery, [vendor_id, user_id, user_name, property_id || null, rating, review_title, review_body]);
        
        res.status(201).json({ 
            identifier: responseIdentifier, 
            data: { message: 'Review submitted successfully.' }
        });
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Get a vendor's full details (profile, services, portfolio, reviews)
 * @route POST /api/v1/vendors/details
 */
const getVendorDetails = async (req, res) => {
    const { identifier, data } = req.body;
    const { vendor_id } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!vendor_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"vendor_id" is required.' }
        });
    }

    try {
        // Fetch all data in parallel
        const [profileRes, servicesRes, portfolioRes, reviewsRes] = await Promise.all([
            // 1. Get main profile
            db.query('SELECT * FROM vendors WHERE vendor_id = $1', [vendor_id]),
            // 2. Get services
            db.query(`
                SELECT s.service_id, s.name, s.description FROM services s
                JOIN vendor_services vs ON s.service_id = vs.service_id
                WHERE vs.vendor_id = $1
            `, [vendor_id]),
            // 3. Get portfolio images
            db.query('SELECT image_url, caption FROM vendor_portfolio_images WHERE vendor_id = $1 ORDER BY display_order', [vendor_id]),
            
            // 4. Get recent reviews (no longer needs JOIN for user_name)
            db.query('SELECT * FROM vendor_reviews WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 10', [vendor_id])
        ]);

        if (profileRes.rows.length === 0) {
            return res.status(404).json({ identifier: responseIdentifier, data: { error: 'Vendor not found.' } });
        }

        const responseData = {
            profile: profileRes.rows[0],
            services: servicesRes.rows,
            portfolio: portfolioRes.rows,
            reviews: reviewsRes.rows
        };

        res.status(200).json({
            identifier: responseIdentifier,
            data: responseData
        });

    } catch (error) {
        console.error('Error fetching vendor details:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description List vendors, e.g., by service
 * @route POST /api/v1/vendors/search-by-service
 */
const listVendorsByService = async (req, res) => {
    const { identifier, data } = req.body;
    const { service_id, page = 1, limit = 10 } = data;
    const offset = (page - 1) * limit;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!service_id) {
         return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"service_id" is required.' }
        });
    }

    try {
        // Query updated to use new column names
        const query = `
            SELECT v.* FROM vendors v
            JOIN vendor_services vs ON v.vendor_id = vs.vendor_id
            WHERE vs.service_id = $1
            ORDER BY v.average_rating DESC, v.review_count DESC
            LIMIT $2 OFFSET $3;
        `;
        const vendorsResult = await db.query(query, [service_id, limit, offset]);

        // We'd also add a COUNT(*) query for pagination, similar to property search
        
        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                vendors: vendorsResult.rows
                // ... pagination data
            }
        });
    } catch (error) {
         console.error('Error searching vendors:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Get all reviews for a specific vendor (paginated)
 * @route POST /api/v1/vendors/reviews/list
 */
const listVendorReviews = async (req, res) => {
    const { identifier, data } = req.body;
    const { vendor_id, page = 1, limit = 10 } = data;
    const offset = (page - 1) * limit;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!vendor_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"vendor_id" is required.' }
        });
    }

    try {
        // Run queries in parallel
        const [reviewsRes, totalRes] = await Promise.all([
            db.query(
                'SELECT * FROM vendor_reviews WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
                [vendor_id, limit, offset]
            ),
            db.query(
                'SELECT COUNT(*) FROM vendor_reviews WHERE vendor_id = $1',
                [vendor_id]
            )
        ]);

        const reviews = reviewsRes.rows;
        const totalCount = parseInt(totalRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalCount / limit);

        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                reviews,
                pagination: {
                    total: totalCount,
                    totalPages,
                    currentPage: page,
                    limit
                }
            }
        });

    } catch (error) {
        console.error('Error listing reviews:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Update an existing review
 * @route POST /api/v1/vendors/reviews/update
 */
const updateReview = async (req, res) => {
    const { identifier, data } = req.body;
    // user_id is used for auth, review_id is the target
    const { review_id, user_id, rating, review_title, review_body } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!review_id || !user_id || !rating) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"review_id", "user_id", and "rating" are required.' }
        });
    }

    try {
        // We securely check that the review 'id' matches the 'user_id'
        // A user can only update their own review.
        const query = `
            UPDATE vendor_reviews
            SET 
                rating = $1, 
                review_title = $2, 
                review_body = $3,
                created_at = NOW()
            WHERE 
                id = $4 AND user_id = $5
            RETURNING *;
        `;
        const result = await db.query(query, [rating, review_title, review_body, review_id, user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                identifier: responseIdentifier,
                data: { error: 'Review not found or user not authorized to update.' }
            });
        }
        
        // The trigger 'trg_update_vendor_rating' will fire automatically.
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: {
                message: "Review updated successfully.",
                review: result.rows[0]
            }
        });

    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Delete a review
 * @route POST /api/v1/vendors/reviews/delete
 */
const deleteReview = async (req, res) => {
    const { identifier, data } = req.body;
    const { review_id, user_id } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!review_id || !user_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"review_id" and "user_id" are required.' }
        });
    }

    try {
        // Securely check that the review 'id' matches the 'user_id'
        const query = `
            DELETE FROM vendor_reviews
            WHERE id = $1 AND user_id = $2
            RETURNING *;
        `;
        const result = await db.query(query, [review_id, user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                identifier: responseIdentifier,
                data: { error: 'Review not found or user not authorized to delete.' }
            });
        }
        
        // The trigger 'trg_update_vendor_rating' will fire automatically.
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { message: 'Review deleted successfully.' }
        });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};



/**
 * @description Get a list of all vendors (paginated)
 * @route POST /api/v1/vendors/list
 */
const listAllVendors = async (req, res) => {
    const { identifier, data } = req.body;
    const { page = 1, limit = 10 } = data || {}; // data can be empty
    const offset = (page - 1) * limit;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    try {
        // Run queries in parallel
        const [vendorsRes, totalRes] = await Promise.all([
            db.query(
                `SELECT vendor_id, name, contact_name, phone, email, city, average_rating, review_count 
                 FROM vendors 
                 ORDER BY created_at DESC 
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            ),
            db.query('SELECT COUNT(*) FROM vendors')
        ]);

        const vendors = vendorsRes.rows;
        const totalCount = parseInt(totalRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalCount / limit);

        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                vendors,
                pagination: {
                    total: totalCount,
                    totalPages,
                    currentPage: page,
                    limit
                }
            }
        });

    } catch (error) {
        console.error('Error listing vendors:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};




module.exports = {
    createVendor,
    addReview,
    getVendorDetails,
    listVendorsByService,
    listAllVendors,
    listVendorReviews, 
    updateReview,      
    deleteReview       
};

