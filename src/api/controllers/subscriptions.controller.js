const db = require('../../config/database');

/**
 * @description Create a new subscription plan
 * @route POST /api/v1/subscriptions/create
 */
const createPlan = async (req, res) => {
    const { identifier, data } = req.body;
    const responseIdentifier = identifier || { request_id: null, user_id: null };
    const { 
        name, 
        price, 
        duration_days, 
        plan_type, // 'agent' or 'vendor'
        features   // This is the new jsonb field
    } = data;

    if (!name || !price || !duration_days || !plan_type) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"name", "price", "duration_days", and "plan_type" are required.' } 
        });
    }

    try {
        const query = `
            INSERT INTO subscription_plans (name, price, duration_days, plan_type, features)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        
        // FIX: Explicitly stringify the features array for the JSONB column
        const featuresJson = features ? JSON.stringify(features) : null;

        const result = await db.query(query, [name, price, duration_days, plan_type, featuresJson]);
        
        res.status(201).json({ 
            identifier: responseIdentifier, 
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error creating plan:', error);
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'A plan with this name already exists.' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' } 
        });
    }
};

/**
 * @description Get a list of all subscription plans (can filter by type)
 * @route POST /api/v1/subscriptions/list
 */
const getAllPlans = async (req, res) => {
    const { identifier, data } = req.body;
    const responseIdentifier = identifier || { request_id: null, user_id: null };
    const { plan_type, is_active } = data || {};

    let query = 'SELECT * FROM subscription_plans';
    const values = [];
    const conditions = [];
    let queryIndex = 1;

    if (plan_type) {
        conditions.push(`plan_type = $${queryIndex++}`);
        values.push(plan_type);
    }
    
    if (is_active !== undefined) {
        conditions.push(`is_active = $${queryIndex++}`);
        values.push(is_active);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY price ASC';

    try {
        const result = await db.query(query, values);
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { subscription_plans: result.rows }
        });

    } catch (error) {
        console.error('Error listing plans:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Update an existing subscription plan
 * @route POST /api/v1/subscriptions/update
 */
const updatePlan = async (req, res) => {
    const { identifier, data } = req.body;
    const responseIdentifier = identifier || { request_id: null, user_id: null };
    // Updated to include 'features' and remove 'description'
    const { plan_id, name, price, duration_days, is_active, plan_type, features } = data;

    if (!plan_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"plan_id" is required.' }
        });
    }

    try {
        // Dynamically build SET clause
        // Updated fields
        const fields = { name, price, duration_days, is_active, plan_type, features };
        const updates = [];
        const values = [];
        let queryIndex = 1;

        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) {
                updates.push(`${key} = $${queryIndex++}`);
                
                // FIX: Apply the same JSON.stringify logic for updates
                if (key === 'features') {
                    values.push(value ? JSON.stringify(value) : null);
                } else {
                    values.push(value);
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ 
                identifier: responseIdentifier, 
                data: { error: 'No update fields provided.' } 
            });
        }

        values.push(plan_id); // For the WHERE clause
        const query = `
            UPDATE subscription_plans
            SET ${updates.join(', ')}
            WHERE plan_id = $${queryIndex}
            RETURNING *;
        `;
        
        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                identifier: responseIdentifier,
                data: { error: 'Subscription plan not found.' }
            });
        }
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating plan:', error);
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'A plan with this name already exists.' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Delete a subscription plan
 * @route POST /api/v1/subscriptions/delete
 */
const deletePlan = async (req, res) => {
    const { identifier, data } = req.body;
    const { plan_id } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!plan_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"plan_id" is required.' }
        });
    }

    try {
        const query = 'DELETE FROM subscription_plans WHERE plan_id = $1 RETURNING *;';
        const result = await db.query(query, [plan_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                identifier: responseIdentifier,
                data: { error: 'Subscription plan not found.' }
            });
        }
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { message: 'Subscription plan deleted successfully.' }
        });
    } catch (error) {
        console.error('Error deleting plan:', error);
        // Handle foreign key constraint violation (if an agent/vendor is using this plan)
        if (error.code === '23503') {
            return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'Cannot delete plan. It is currently in use by one or more users.' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};


/**
 * @description Get a list of all subscription plans with advanced filtering
 * @route POST /api/v1/subscriptions/list
 */
const listSubscriptionPlans = async (req, res) => {
    const { identifier, data } = req.body;
    const { 
        plan_type, 
        is_active,
        name,
        min_price,
        max_price,
        min_duration,
        max_duration,
        feature // A single string to check for in the features array
    } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    let baseQuery = 'SELECT * FROM subscription_plans';
    const whereClauses = [];
    const values = [];

    if (plan_type) {
        values.push(plan_type);
        whereClauses.push(`plan_type = $${values.length}`);
    }
    
    if (is_active !== undefined) { // Check for undefined to allow filtering for `false`
        values.push(is_active);
        whereClauses.push(`is_active = $${values.length}`);
    }

    if (name) {
        values.push(`%${name}%`); // Add wildcards for partial match
        whereClauses.push(`name ILIKE $${values.length}`);
    }

    if (min_price) {
        values.push(min_price);
        whereClauses.push(`price >= $${values.length}`);
    }
    
    if (max_price) {
        values.push(max_price);
        whereClauses.push(`price <= $${values.length}`);
    }

    if (min_duration) {
        values.push(min_duration);
        whereClauses.push(`duration_days >= $${values.length}`);
    }

    if (max_duration) {
        values.push(max_duration);
        whereClauses.push(`duration_days <= $${values.length}`);
    }

    if (feature) {
        // For jsonb @> operator, we must provide a JSON array string
        values.push(JSON.stringify([feature])); 
        whereClauses.push(`features @> $${values.length}`);
    }

    let finalQuery = baseQuery;
    if (whereClauses.length > 0) {
        finalQuery += ' WHERE ' + whereClauses.join(' AND ');
    }
    finalQuery += ' ORDER BY price ASC;'; // Add a default sort

    try {
        const result = await db.query(finalQuery, values);
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { plans: result.rows }
        });
    } catch (error) {
        console.error('Error listing subscription plans:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

module.exports = {
    createPlan,
    listSubscriptionPlans,
    updatePlan,
    deletePlan
};

