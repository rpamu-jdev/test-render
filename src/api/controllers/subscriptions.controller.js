const db = require('../../config/database');

/**
 * @description Create a new subscription plan
 * @route POST /api/v1/subscriptions/create
 */
const createPlan = async (req, res) => {
    const { identifier, data } = req.body;
    const { name, price, duration_days, features } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!name || !price || !duration_days) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"name", "price", and "duration_days" are required.' }
        });
    }

    try {
        const query = `
            INSERT INTO subscription_plans (name, price, duration_days, features)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        // Convert features array to JSON string if it's an object/array
        const featuresJson = features ? JSON.stringify(features) : null;
        const result = await db.query(query, [name, price, duration_days, featuresJson]);
        
        res.status(201).json({ 
            identifier: responseIdentifier, 
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating plan:', error);
        if (error.code === '23505') {
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
 * @description Get a list of all active subscription plans
 * @route POST /api/v1/subscriptions/list
 */
const listPlans = async (req, res) => {
    const { identifier } = req.body;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    try {
        // Only list plans that are active
        const query = 'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price ASC';
        const result = await db.query(query);
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { plans: result.rows }
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
 * @description Update a subscription plan
 * @route POST /api/v1/subscriptions/update
 */
const updatePlan = async (req, res) => {
    const { identifier, data } = req.body;
    const { plan_id, name, price, duration_days, features, is_active } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!plan_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"plan_id" is required.' }
        });
    }

    try {
        // Dynamically build SET clause based on provided fields
        const fields = [];
        const values = [];
        let queryIndex = 1;

        if (name) { fields.push(`name = $${queryIndex++}`); values.push(name); }
        if (price) { fields.push(`price = $${queryIndex++}`); values.push(price); }
        if (duration_days) { fields.push(`duration_days = $${queryIndex++}`); values.push(duration_days); }
        if (features) { fields.push(`features = $${queryIndex++}`); values.push(JSON.stringify(features)); }
        if (is_active !== undefined) { fields.push(`is_active = $${queryIndex++}`); values.push(is_active); }

        if (fields.length === 0) {
            return res.status(400).json({ identifier: responseIdentifier, data: { error: 'No fields to update.' } });
        }
        
        values.push(plan_id); // For the WHERE clause
        const query = `
            UPDATE subscription_plans
            SET ${fields.join(', ')}
            WHERE plan_id = $${queryIndex}
            RETURNING *;
        `;
        
        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ identifier: responseIdentifier, data: { error: 'Plan not found.' } });
        }
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating plan:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Delete (deactivate) a subscription plan
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
        // We'll soft-delete by setting is_active = false
        const query = 'UPDATE subscription_plans SET is_active = false WHERE plan_id = $1 RETURNING *;';
        const result = await db.query(query, [plan_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ identifier: responseIdentifier, data: { error: 'Plan not found.' } });
        }
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { message: 'Plan deactivated successfully.' }
        });
    } catch (error) {
        console.error('Error deleting plan:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

module.exports = {
    createPlan,
    listPlans,
    updatePlan,
    deletePlan
};

