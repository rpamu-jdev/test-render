const db = require('../../config/database');

/**
 * @description Adds a property to a user's favorites list.
 * @route POST /api/v1/users/favorites/add
 */
const addFavorite = async (req, res) => {
  const { identifier, data } = req.body;
  const { user_id, property_id } = data;
  const responseIdentifier = identifier || { id: req.body.identifier?.id, user: null };

  if (!user_id || !property_id) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request "data" must include "user_id" and "property_id".' }
    });
  }

  try {
    const query = 'INSERT INTO user_favorites (user_id, property_id) VALUES ($1, $2)';
    await db.query(query, [user_id, property_id]);
    res.status(201).json({
      identifier: responseIdentifier,
      data: { message: 'Property added to favorites successfully.' }
    });
  } catch (error) {
    // This specific error code means the user already favorited this property
    if (error.code === '23505') {
      return res.status(409).json({
        identifier: responseIdentifier,
        data: { error: 'This property is already in your favorites.' }
      });
    }
    console.error('Error adding favorite:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An internal server error occurred.' }
    });
  }
};

/**
 * @description Removes a property from a user's favorites list.
 * @route POST /api/v1/users/favorites/remove
 */
const removeFavorite = async (req, res) => {
    const { identifier, data } = req.body;
    const { user_id, property_id } = data;
    const responseIdentifier = identifier || { id: req.body.identifier?.id, user: null };

    if (!user_id || !property_id) {
        return res.status(400).json({
          identifier: responseIdentifier,
          data: { error: 'Request "data" must include "user_id" and "property_id".' }
        });
    }

    try {
        const query = 'DELETE FROM user_favorites WHERE user_id = $1 AND property_id = $2';
        const result = await db.query(query, [user_id, property_id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
              identifier: responseIdentifier,
              data: { error: 'Favorite not found.' }
            });
        }
        res.status(200).json({
          identifier: responseIdentifier,
          data: { message: 'Property removed from favorites successfully.' }
        });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({
          identifier: responseIdentifier,
          data: { error: 'An internal server error occurred.' }
        });
    }
};

/**
 * @description Retrieves a paginated list of a user's favorite properties.
 * @route POST /api/v1/users/favorites/list
 */
const getFavorites = async (req, res) => {
    const { identifier, data } = req.body;
    const { user_id } = data;
    const { page = 1, limit = 10 } = data;
    const offset = (page - 1) * limit;
    const responseIdentifier = identifier || { id: req.body.identifier?.id, user: null };

    if (!user_id) {
        return res.status(400).json({
          identifier: responseIdentifier,
          data: { error: 'Request "data" must include "user_id".' }
        });
    }

    try {
        const favoritesQuery = `
            SELECT p.* FROM properties p
            JOIN user_favorites uf ON p.property_id = uf.property_id
            WHERE uf.user_id = $1
            ORDER BY uf.created_at DESC
            LIMIT $2 OFFSET $3;
        `;
        
        const countQuery = 'SELECT COUNT(*) FROM user_favorites WHERE user_id = $1';

        // Run queries concurrently
        const [favoritesResult, countResult] = await Promise.all([
            db.query(favoritesQuery, [user_id, limit, offset]),
            db.query(countQuery, [user_id])
        ]);

        const totalFavorites = parseInt(countResult.rows[0].count, 10);

        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                favorites: favoritesResult.rows,
                pagination: {
                    current_page: page,
                    total_pages: Math.ceil(totalFavorites / limit),
                    total_favorites: totalFavorites
                }
            }
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({
          identifier: responseIdentifier,
          data: { error: 'An internal server error occurred.' }
        });
    }
};



/**
 * @description Retrieves a paginated list of a user's recently viewed properties,
 * ordered by the most recently viewed.
 * @route POST /api/v1/users/views/list
 */
const getRecentlyViewed = async (req, res) => {
    const { identifier, data } = req.body;
    const { user_id } = data;
    const { page = 1, limit = 10 } = data;
    const offset = (page - 1) * limit;
    const responseIdentifier = identifier || { request_id: null, user_id: null };

    if (!user_id) {
        return res.status(400).json({
            identifier: responseIdentifier,
            data: { error: 'Request "data" must include "user_id".' }
        });
    }

    try {
        // Query to get the paginated list of viewed properties
        const viewsQuery = `
            SELECT p.*, urv.viewed_at FROM properties p
            JOIN user_recently_viewed urv ON p.property_id = urv.property_id
            WHERE urv.user_id = $1
            ORDER BY urv.viewed_at DESC
            LIMIT $2 OFFSET $3;
        `;
        
        // Query to get the total count for pagination metadata
        const countQuery = 'SELECT COUNT(*) FROM user_recently_viewed WHERE user_id = $1';

        // Run both queries concurrently for better performance
        const [viewsResult, countResult] = await Promise.all([
            db.query(viewsQuery, [user_id, limit, offset]),
            db.query(countQuery, [user_id])
        ]);

        const totalViews = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalViews / limit);

        res.status(200).json({
            identifier: responseIdentifier,
            data: {
                recently_viewed: viewsResult.rows,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_items: totalViews
                }
            }
        });
    } catch (error) {
        console.error('Error fetching recently viewed properties:', error);
        res.status(500).json({
            identifier: responseIdentifier,
            data: { error: 'An internal server error occurred.' }
        });
    }
};

// Note: Assumes you have `const db = require('../../config/database');` at the top.

/**
 * @description Create a new user
 * @route POST /api/v1/users/create
 */
const createUser = async (req, res) => {
  const { identifier, data } = req.body;
  const response_identifier = identifier || { request_id: null, user_id: null };

  const { user_id, name, email, phone, profile_image_url } = data;
  
  // CHANGED: Set the user_role from data, or default to 'customer'
  // This lines up with our database default, but it's good to be explicit.
  const user_role = data.user_role || 'customer';

  if (!user_id || !name || !email || !phone) {
    return res.status(400).json({
      identifier: response_identifier,
      data: { error: 'Request data must contain user_id, name, email, and phone.' },
    });
  }

  try {
    // CHANGED: Added 'user_role' to the INSERT query
    const query = `
      INSERT INTO users (user_id, name, email, phone, profile_image_url, user_role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING -- Fails silently if user already exists
      RETURNING 
        user_id, 
        name, 
        email, 
        phone, 
        profile_image_url, 
        user_role, -- CHANGED: Added user_role to RETURNING
        created_at, 
        updated_at;
    `;
    
    // CHANGED: Added user_role as the 6th parameter ($6)
    const { rows } = await db.query(query, [user_id, name, email, phone, profile_image_url, user_role]);

    if (rows.length === 0) {
      return res.status(409).json({
        identifier: response_identifier,
        data: { error: 'User with this user_id already exists.' }
      });
    }

    res.status(201).json({
      identifier: response_identifier,
      data: { message: 'User created successfully', user: rows[0] },
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      identifier: response_identifier,
      data: { error: 'An error occurred while creating the user.' }
    });
  }
};

/**
 * @description Get a single user by their ID
 * @route POST /api/v1/users/get-by-id
 */
const getUserById = async (req, res) => {
  const { identifier, data } = req.body;
  const response_identifier = identifier || { request_id: null, user_id: null };
  const { user_id } = data;

  if (!user_id) {
    return res.status(400).json({
      identifier: response_identifier,
      data: { error: 'Request data must contain user_id.' },
    });
  }

  try {
    // CHANGED: Added 'user_role' to the SELECT statement
    const query = `
      SELECT 
        user_id, 
        name, 
        email, 
        phone, 
        profile_image_url,
        user_role,
        created_at, 
        updated_at
      FROM users 
      WHERE user_id = $1;
    `;
    const { rows } = await db.query(query, [user_id]); 

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: response_identifier,
        data: { error: 'User not found.' }
      });
    }

    res.status(200).json({
      identifier: response_identifier,
      data: rows[0],
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      identifier: response_identifier,
      data: { error: 'An error occurred while fetching the user.' }
    });
  }
};

/**
 * @description Update an existing user's details
 * @route POST /api/v1/users/update
 */
const updateUser = async (req, res) => {
  const { identifier, data } = req.body;
  const response_identifier = identifier || { request_id: null, user_id: null };
  
  // CHANGED: Added 'user_role' to destructuring
  const { user_id, name, phone, profile_image_url, user_role } = data;

  if (!user_id) {
    return res.status(400).json({
      identifier: response_identifier,
      data: { error: 'Request data must contain user_id.' },
    });
  }

  const fields = [];
  const values = [];
  let param_index = 1;

  if (name) {
    fields.push(`name = $${param_index++}`);
    values.push(name);
  }
  if (phone) {
    fields.push(`phone = $${param_index++}`);
    values.push(phone);
  }
  if (profile_image_url) {
    fields.push(`profile_image_url = $${param_index++}`);
    values.push(profile_image_url);
  }
  
  // CHANGED: Allow updating the user_role
  // You might want to add security/admin checks here in a real app
  if (user_role) { 
    fields.push(`user_role = $${param_index++}`);
    values.push(user_role);
  }

  if (fields.length === 0) {
     return res.status(400).json({
      identifier: response_identifier,
      data: { error: 'Request data must contain at least one field to update (name, phone, profile_image_url, user_role).' }, // CHANGED: Added user_role to error
    });
  }

  values.push(user_id);

  try {
    // CHANGED: Added 'user_role' to RETURNING
    const query = `
      UPDATE users SET
        ${fields.join(', ')},
        updated_at = NOW()
      WHERE user_id = $${param_index}
      RETURNING 
        user_id, 
        name, 
        email, 
        phone, 
        profile_image_url, 
        user_role,
        created_at, 
        updated_at;
    `;

    const { rows } = await db.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: response_identifier,
        data: { error: 'User not found.' }
      });
    }

    res.status(200).json({
      identifier: response_identifier,
      data: { message: 'User updated successfully', user: rows[0] },
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      identifier: response_identifier,
      data: { error: 'An error occurred while updating the user.' }
    });
  }
};

/**
 * @description Delete a user
 * @route POST /api/v1/users/delete
 */
const deleteUser = async (req, res) => {
  // NO CHANGES NEEDED in this function
  
  const { identifier, data } = req.body;
  const response_identifier = identifier || { request_id: null, user_id: null };
  const { user_id } = data;

  if (!user_id) {
    return res.status(400).json({
      identifier: response_identifier,
      data: { error: 'Request data must contain user_id.' },
    });
  }

  try {
    const query = 'DELETE FROM users WHERE user_id = $1 RETURNING *;';
    const { rows } = await db.query(query, [user_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: response_identifier,
        data: { error: 'User not found.' }
      });
    }

    res.status(200).json({
      identifier: response_identifier,
      data: { message: 'User deleted successfully.' }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      identifier: response_identifier,
      data: { error: 'An error occurred while deleting the user.' }
    });
  }
};

/**
 * @description List and search all users with pagination
 * @route POST /api/v1/user/list
 */
const listAndSearchUsers = async (req, res) => {
  console.log("listAndSearchUsers");
  const { identifier, data } = req.body;

  const response_identifier = identifier || { request_id: null, user_id: null };

  // CHANGED: Added 'user_role' to allow filtering by role
  const { search_query, page, limit, user_role } = data;

  const page_num = parseInt(page, 10) || 1;
  const limit_num = parseInt(limit, 10) || 20;
  const offset = (page_num - 1) * limit_num;

  // --- CHANGED: Switched to a more dynamic query builder ---
  const where_conditions = [];
  const params = [];
  let param_index = 1;

  if (search_query) {
    params.push(`%${search_query}%`);
    // $1 will be the search_query
    where_conditions.push(`(name ILIKE $${param_index} OR email ILIKE $${param_index} OR phone ILIKE $${param_index})`);
    param_index++;
  }
  
  // CHANGED: Add filter for user_role if it's provided in the request
  if (user_role) {
    params.push(user_role);
    where_conditions.push(`user_role = $${param_index}`);
    param_index++;
  }

  const where_clause = where_conditions.length > 0 ? `WHERE ${where_conditions.join(' AND ')}` : "";
  // --- End of dynamic query builder changes ---

  try {
    // 1. Get a high-speed ESTIMATED count
    const estimate_query = `EXPLAIN (FORMAT JSON) SELECT 1 FROM users ${where_clause}`;
    const estimate_result = await db.query(estimate_query, params);
    
    const total_items = estimate_result.rows[0]['QUERY PLAN'][0]['Plan Rows'];
    const total_pages = Math.ceil(total_items / limit_num);

    // 2. Get the paginated data
    const data_params = [...params]; 
    data_params.push(limit_num);      // Add LIMIT
    data_params.push(offset);         // Add OFFSET

    // CHANGED: Added 'user_role' to SELECT and updated LIMIT/OFFSET param indexes
    const list_query = `
      SELECT 
        user_id, 
        name, 
        email, 
        phone, 
        profile_image_url,
        user_role, 
        created_at, 
        updated_at
      FROM users
      ${where_clause}
      ORDER BY name ASC
      LIMIT $${param_index} OFFSET $${param_index + 1};
    `;
    
    const list_result = await db.query(list_query, data_params);
    const users = list_result.rows;

    // 3. Send the structured response
    res.status(200).json({
      identifier: response_identifier,
      data: {
        users: users,
        pagination: {
          total_items: total_items, 
          total_pages: total_pages,
          current_page: page_num,
          page_size: limit_num
        }
      }
    });

  } catch (error) {
    console.error('Error listing/searching users:', error);
    res.status(500).json({
      identifier: response_identifier,
      data: { error: 'An error occurred while fetching users.' }
    });
  }
};

module.exports = {
  addFavorite,
  removeFavorite,
  getFavorites,
  getRecentlyViewed,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  listAndSearchUsers,
};
