const db = require('../../config/database');

/**
 * @description Create a new service
 * @route POST /api/v1/services/create
 */
const createService = async (req, res) => {
    const { identifier, data } = req.body;
    const { name, description } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!name) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"name" is required.' } 
        });
    }

    try {
        const query = `
            INSERT INTO services (name, description)
            VALUES ($1, $2)
            RETURNING *;
        `;
        const result = await db.query(query, [name, description || null]);
        
        res.status(201).json({ 
            identifier: responseIdentifier, 
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating service:', error);
        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'A service with this name already exists.' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Get a list of all services
 * @route POST /api/v1/services/list
 */
const getAllServices = async (req, res) => {
    const { identifier } = req.body;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    try {
        const query = 'SELECT * FROM services ORDER BY name ASC';
        const result = await db.query(query);
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { services: result.rows }
        });
    } catch (error) {
        console.error('Error listing services:', error);
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Update an existing service
 * @route POST /api/v1/services/update
 */
const updateService = async (req, res) => {
    const { identifier, data } = req.body;
    const { service_id, name, description } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!service_id || !name) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"service_id" and "name" are required.' }
        });
    }

    try {
        const query = `
            UPDATE services
            SET name = $1, description = $2
            WHERE service_id = $3
            RETURNING *;
        `;
        const result = await db.query(query, [name, description, service_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                identifier: responseIdentifier,
                data: { error: 'Service not found.' }
            });
        }
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating service:', error);
        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'A service with this name already exists.' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Delete a service
 * @route POST /api/v1/services/delete
 */
const deleteService = async (req, res) => {
    const { identifier, data } = req.body;
    const { service_id } = data;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!service_id) {
        return res.status(400).json({ 
            identifier: responseIdentifier, 
            data: { error: '"service_id" is required.' }
        });
    }

    try {
        const query = 'DELETE FROM services WHERE service_id = $1 RETURNING *;';
        const result = await db.query(query, [service_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                identifier: responseIdentifier,
                data: { error: 'Service not found.' }
            });
        }
        
        res.status(200).json({ 
            identifier: responseIdentifier, 
            data: { message: 'Service deleted successfully.' }
        });
    } catch (error) {
        console.error('Error deleting service:', error);
        // Handle foreign key constraint violation (if a vendor is using this service)
        if (error.code === '23503') {
            return res.status(409).json({
                identifier: responseIdentifier,
                data: { error: 'Cannot delete service. It is currently in use by one or more vendors.' }
            });
        }
        res.status(500).json({ 
            identifier: responseIdentifier, 
            data: { error: 'An internal server error occurred.' }
        });
    }
};

module.exports = {
    createService,
    getAllServices,
    updateService,
    deleteService
};
    