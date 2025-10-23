const db = require('../../config/database');
// const bcrypt = require('bcryptjs'); // No longer needed

/**
 * @description Create a new agent (Admin action)
 * @route POST /api/v1/agents/create
 */
const createAgent = async (req, res) => {
    const { identifier, data } = req.body;
    const { name, email, phone, agency_name, license_number, city, about, profile_image_url } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!name || !email || !phone) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: 'Name, email, and phone are required.' }
        });
    }

    try {
        const query = `
            INSERT INTO agents (name, email, phone, agency_name, license_number, city, about, profile_image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const result = await db.query(query, [name, email, phone, agency_name, license_number, city, about, profile_image_url]);

        // Exclude sensitive fields from response if any (password_hash is already gone)
        delete result.rows[0].password_hash;

        res.status(201).json({
            identifier: responseIdentifier,
            data: { message: "Agent created successfully", agent: result.rows[0] }
        });

    } catch (error) {
        console.error('Error creating agent:', error);
        if (error.code === '23505') {
            return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'An agent with this email or phone already exists.' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Update agent details (Admin action)
 * @route POST /api/v1/agents/update
 */
const updateAgent = async (req, res) => {
    const { identifier, data } = req.body;
    const { agent_id, name, email, phone, agency_name, license_number, city, about, profile_image_url } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!agent_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"agent_id" is required.' }
        });
    }

    try {
        // Dynamically build SET clause
        const fields = [];
        const values = [];
        let queryIndex = 1;

        if (name) { fields.push(`name = $${queryIndex++}`); values.push(name); }
        if (email) { fields.push(`email = $${queryIndex++}`); values.push(email); }
        if (phone) { fields.push(`phone = $${queryIndex++}`); values.push(phone); }
        if (agency_name) { fields.push(`agency_name = $${queryIndex++}`); values.push(agency_name); }
        if (license_number) { fields.push(`license_number = $${queryIndex++}`); values.push(license_number); }
        if (city) { fields.push(`city = $${queryIndex++}`); values.push(city); }
        if (about) { fields.push(`about = $${queryIndex++}`); values.push(about); }
        if (profile_image_url) { fields.push(`profile_image_url = $${queryIndex++}`); values.push(profile_image_url); }
        
        if (fields.length === 0) {
            return res.status(400).json({ identifier: responseIdentifier, data: { error: 'No fields to update.' } });
        }

        values.push(agent_id); // For the WHERE clause
        const query = `
            UPDATE agents
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE agent_id = $${queryIndex}
            RETURNING *;
        `;
        
        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ identifier: responseIdentifier, data: { error: 'Agent not found.' } });
        }

        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { message: "Agent updated successfully", agent: result.rows[0] }
        });
    } catch (error) {
        console.error('Error updating agent:', error);
         if (error.code === '23505') {
            return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'An agent with this email or phone already exists.' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Delete an agent (Admin action)
 * @route POST /api/v1/agents/delete
 */
const deleteAgent = async (req, res) => {
    const { identifier, data } = req.body;
    const { agent_id } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!agent_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"agent_id" is required.' }
        });
    }

    try {
        const query = 'DELETE FROM agents WHERE agent_id = $1 RETURNING *;';
        const result = await db.query(query, [agent_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ identifier: responseIdentifier, data: { error: 'Agent not found.' } });
        }
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { message: 'Agent deleted successfully.' }
        });
    } catch (error) {
        console.error('Error deleting agent:', error);
         // Handle potential foreign key issues if an agent has reviews/etc.
        if (error.code === '23503') {
             return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'Cannot delete agent. They are referenced by other records (e.g., reviews).' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};


/**
 * @description Assign a subscription to an agent (e.g., after payment)
 * @route POST /api/v1/agents/subscribe
 */
const subscribeToPlan = async (req, res) => {
    const { identifier, data } = req.body;
    const { agent_id, plan_id } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!agent_id || !plan_id) {
         return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"agent_id" and "plan_id" are required.' }
        });
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 1. Get plan duration
        const planRes = await client.query('SELECT duration_days FROM subscription_plans WHERE plan_id = $1 AND is_active = true', [plan_id]);
        if (planRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ identifier: responseIdentifier, data: { error: 'Active plan not found.' } });
        }
        const duration = planRes.rows[0].duration_days;

        // 2. Update the agent's subscription
        const query = `
            UPDATE agents
            SET 
                plan_id = $1,
                subscription_status = 'active',
                subscription_starts_at = NOW(),
                subscription_expires_at = NOW() + ($2 * INTERVAL '1 day'),
                updated_at = NOW()
            WHERE 
                agent_id = $3
            RETURNING agent_id, plan_id, subscription_status, subscription_expires_at;
        `;
        const result = await client.query(query, [plan_id, duration, agent_id]);

        if (result.rows.length === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ identifier: responseIdentifier, data: { error: 'Agent not found.' } });
        }

        await client.query('COMMIT');
        res.status(200).json({
            identifier: responseIdentifier,
            data: { message: "Subscription activated successfully", subscription: result.rows[0] }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error subscribing agent:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    } finally {
        client.release();
    }
};

/**
 * @description Get an agent's full details (profile, subscription, reviews)
 * @route POST /api/v1/agents/details
 */
const getAgentDetails = async (req, res) => {
    const { identifier, data } = req.body;
    const { agent_id } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

     if (!agent_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"agent_id" is required.' }
        });
    }

    try {
        const [profileRes, reviewsRes] = await Promise.all([
            // Get profile and join with subscription plan
            db.query(`
                SELECT a.agent_id, a.name, a.email, a.phone, a.agency_name, 
                       a.license_number, a.city, a.about, a.profile_image_url, 
                       a.subscription_status, a.subscription_expires_at, 
                       a.average_rating, a.review_count,
                       p.name AS plan_name, p.features AS plan_features
                FROM agents a
                LEFT JOIN subscription_plans p ON a.plan_id = p.plan_id
                WHERE a.agent_id = $1
            `, [agent_id]),
            // Get recent reviews
            db.query('SELECT * FROM agent_reviews WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 10', [agent_id])
        ]);

        if (profileRes.rows.length === 0) {
            return res.status(404).json({ identifier: responseIdentifier, data: { error: 'Agent not found.' } });
        }

        const profile = profileRes.rows[0];
        
        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                profile,
                reviews: reviewsRes.rows
            }
        });

    } catch (error) {
        console.error('Error getting agent details:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

// --- Agent Review CRUD Functions ---

/**
 * @description Add a review for an agent
 * @route POST /api/v1/agents/reviews/add
 */
const addReview = async (req, res) => {
    const { identifier, data } = req.body;
    const { agent_id, user_id, user_name, property_id, rating, review_title, review_body } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!agent_id || !user_id || !user_name || !rating) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"agent_id", "user_id", "user_name", and "rating" are required.' }
        });
    }

    try {
        const reviewQuery = `
            INSERT INTO agent_reviews (agent_id, user_id, user_name, property_id, rating, review_title, review_body)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (agent_id, user_id, property_id) DO UPDATE SET
                rating = EXCLUDED.rating,
                review_title = EXCLUDED.review_title,
                review_body = EXCLUDED.review_body,
                user_name = EXCLUDED.user_name,
                created_at = NOW()
            RETURNING *;
        `;
        const result = await db.query(reviewQuery, [agent_id, user_id, user_name, property_id || null, rating, review_title, review_body]);
        
        res.status(201).json({ 
            identifier: responseIdentifier, 
            data: { message: 'Review submitted successfully.', review: result.rows[0] }
        });
    } catch (error) {
        console.error('Error adding agent review:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Get all reviews for a specific agent (paginated)
 * @route POST /api/v1/agents/reviews/list
 */
const listReviews = async (req, res) => {
    const { identifier, data } = req.body;
    const { agent_id, page = 1, limit = 10 } = data;
    const offset = (page - 1) * limit;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!agent_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"agent_id" is required.' }
        });
    }

    try {
        const [reviewsRes, totalRes] = await Promise.all([
            db.query('SELECT * FROM agent_reviews WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [agent_id, limit, offset]),
            db.query('SELECT COUNT(*) FROM agent_reviews WHERE agent_id = $1', [agent_id])
        ]);

        const reviews = reviewsRes.rows;
        const totalCount = parseInt(totalRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalCount / limit);

        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                reviews,
                pagination: { total: totalCount, totalPages, currentPage: page, limit }
            }
        });
    } catch (error) {
        console.error('Error listing agent reviews:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Update an existing agent review
 * @route POST /api/v1/agents/reviews/update
 */
const updateReview = async (req, res) => {
    const { identifier, data } = req.body;
    const { review_id, user_id, rating, review_title, review_body } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

     if (!review_id || !user_id || !rating) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"review_id", "user_id", and "rating" are required.' }
        });
    }

    try {
        const query = `
            UPDATE agent_reviews
            SET rating = $1, review_title = $2, review_body = $3, created_at = NOW()
            WHERE id = $4 AND user_id = $5
            RETURNING *;
        `;
        const result = await db.query(query, [rating, review_title, review_body, review_id, user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                identifier: responseIdentifier,
                data: { error: 'Review not found or user not authorized to update.' }
            });
        }
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { message: "Review updated successfully.", review: result.rows[0] }
        });
    } catch (error) {
        console.error('Error updating agent review:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Delete an agent review
 * @route POST /api/v1/agents/reviews/delete
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
        const query = `
            DELETE FROM agent_reviews
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
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { message: 'Review deleted successfully.' }
        });
    } catch (error) {
        console.error('Error deleting agent review:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};


/**
 * @description Get a list of all agents (paginated)
 * @route POST /api/v1/agents/list
 */
const listAllAgents = async (req, res) => {
    const { identifier, data } = req.body;
    const { page = 1, limit = 10 } = data || {}; // data can be empty
    const offset = (page - 1) * limit;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    try {
        // Run queries in parallel
        const [agentsRes, totalRes] = await Promise.all([
            db.query(
                `SELECT agent_id, name, email, phone, agency_name, city, 
                        subscription_status, average_rating, review_count 
                 FROM agents 
                 ORDER BY created_at DESC 
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            ),
            db.query('SELECT COUNT(*) FROM agents')
        ]);

        const agents = agentsRes.rows;
        const totalCount = parseInt(totalRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalCount / limit);

        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                agents,
                pagination: {
                    total: totalCount,
                    totalPages,
                    currentPage: page,
                    limit
                }
            }
        });

    } catch (error) {
        console.error('Error listing agents:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};


module.exports = {
    createAgent,
    updateAgent,
    deleteAgent,
    listAllAgents,
    subscribeToPlan,
    getAgentDetails,
    addReview,
    listReviews,
    updateReview,
    deleteReview
};

