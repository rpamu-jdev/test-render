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


/**
 * @description Create a new user
 * @route POST /api/v1/users/create
 */
const createUser = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { requestId: null, userId: null };

  // Note: user_id is provided in the data, as it comes from an auth provider (like Firebase)
  const { userId, name, email, phone, profileImageUrl } = data;

  if (!userId || !name || !email || !phone) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request data must contain userId, name, email, and phone.' },
    });
  }

  try {
    const query = `
      INSERT INTO users (user_id, name, email, phone, profile_image_url, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING -- Fails silently if user already exists
      RETURNING 
        user_id AS "userId", 
        name, 
        email, 
        phone, 
        profile_image_url AS "profileImageUrl", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt";
    `;
    
    const { rows } = await db.query(query, [userId, name, email, phone, profileImageUrl]);

    if (rows.length === 0) {
      // This means the ON CONFLICT triggered
      return res.status(409).json({
        identifier: responseIdentifier,
        data: { error: 'User with this userId already exists.' }
      });
    }

    res.status(201).json({
      identifier: responseIdentifier,
      data: { message: 'User created successfully', user: rows[0] },
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      identifier: responseIdentifier,
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
  const responseIdentifier = identifier || { requestId: null, userId: null };
  const { userId } = data;

  if (!userId) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request data must contain userId.' },
    });
  }

  try {
    const query = `
      SELECT 
        user_id AS "userId", 
        name, 
        email, 
        phone, 
        profile_image_url AS "profileImageUrl", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM users 
      WHERE user_id = $1;
    `;
    const { rows } = await db.query(query, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: responseIdentifier,
        data: { error: 'User not found.' }
      });
    }

    res.status(200).json({
      identifier: responseIdentifier,
      data: rows[0],
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      identifier: responseIdentifier,
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
  const responseIdentifier = identifier || { requestId: null, userId: null };
  
  // User ID is required to know *who* to update
  const { userId, name, phone, profileImageUrl } = data;

  if (!userId) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request data must contain userId.' },
    });
  }

  // Note: We don't allow updating email as it's often a unique login.
  // We also don't allow updating 'name' if it's not provided.
  // This builds the query dynamically based on what fields are provided.

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (name) {
    fields.push(`name = $${paramIndex++}`);
    values.push(name);
  }
  if (phone) {
    fields.push(`phone = $${paramIndex++}`);
    values.push(phone);
  }
  if (profileImageUrl) {
    fields.push(`profile_image_url = $${paramIndex++}`);
    values.push(profileImageUrl);
  }

  if (fields.length === 0) {
     return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request data must contain at least one field to update (name, phone, profileImageUrl).' },
    });
  }

  // Add the user ID for the WHERE clause
  values.push(userId);

  try {
    const query = `
      UPDATE users SET
        ${fields.join(', ')},
        updated_at = NOW()
      WHERE user_id = $${paramIndex}
      RETURNING 
        user_id AS "userId", 
        name, 
        email, 
        phone, 
        profile_image_url AS "profileImageUrl", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt";
    `;

    const { rows } = await db.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: responseIdentifier,
        data: { error: 'User not found.' }
      });
    }

    res.status(200).json({
      identifier: responseIdentifier,
      data: { message: 'User updated successfully', user: rows[0] },
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An error occurred while updating the user.' }
    });
  }
};

/**
 * @description Delete a user
 * @route POST /api/v1/users/delete
 */
const deleteUser = async (req, res) => {
  const { identifier, data } = req.body;
  const responseIdentifier = identifier || { requestId: null, userId: null };
  const { userId } = data;

  if (!userId) {
    return res.status(400).json({
      identifier: responseIdentifier,
      data: { error: 'Request data must contain userId.' },
    });
  }

  try {
    // ON DELETE CASCADE in your schema will handle related data
    const query = 'DELETE FROM users WHERE user_id = $1 RETURNING *;';
    const { rows } = await db.query(query, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        identifier: responseIdentifier,
        data: { error: 'User not found.' }
      });
    }

    res.status(200).json({
      identifier: responseIdentifier,
      data: { message: 'User deleted successfully.' }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      identifier: responseIdentifier,
      data: { error: 'An error occurred while deleting the user.' }
    });
  }
};


// Add this to your user.controller.js
// Make sure you have `const db = require('../../config/database');` at the top

/**
 * @description List and search all users with pagination (using high-speed estimated counts)
 * @route POST /api/v1/user/list
 */
const listAndSearchUsers = async (req, res) => {
  console.log("listAndSearchUsers");
  const { identifier, data } = req.body;

  const responseIdentifier = identifier || { requestId: null, userId: null };

  const { searchQuery, page, limit } = data;

  // Set defaults for pagination
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const offset = (pageNum - 1) * limitNum;

  // --- Dynamic Query Building ---
  let whereClause = "";
  const params = [];

  if (searchQuery) {
    // We will search against name, email, and phone
    params.push(`%${searchQuery}%`);
    // $1 will be the searchQuery
    whereClause = "WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1"; 
  }

  try {
    // 1. Get a high-speed ESTIMATED count
    // We ask Postgres to "explain" the query and give us its plan,
    // which includes an estimated row count. This is almost instant.
    const estimateQuery = `EXPLAIN (FORMAT JSON) SELECT 1 FROM users ${whereClause}`;
    const estimateResult = await db.query(estimateQuery, params);
    
    // The estimated count is nested in the query plan
    const totalItems = estimateResult.rows[0]['QUERY PLAN'][0]['Plan Rows'];
    const totalPages = Math.ceil(totalItems / limitNum);

    // 2. Get the paginated data (This part is the same as before)
    const dataParams = [...params]; // Start with search param, if it exists
    dataParams.push(limitNum);      // Add LIMIT
    dataParams.push(offset);        // Add OFFSET

    const listQuery = `
      SELECT 
        user_id, 
        name, 
        email, 
        phone, 
        profile_image_url, 
        created_at, 
        updated_at
      FROM users
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    
    const listResult = await db.query(listQuery, dataParams);
    const users = listResult.rows;

    // 3. Send the structured response
    res.status(200).json({
      identifier: responseIdentifier,
      data: {
        users: users,
        pagination: {
          totalItems: totalItems, // This is now an estimate
          totalPages: totalPages, // This is also an estimate
          currentPage: pageNum,
          pageSize: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error listing/searching users:', error);
    res.status(500).json({
      identifier: responseIdentifier,
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
