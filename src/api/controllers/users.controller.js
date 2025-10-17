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

module.exports = {
  addFavorite,
  removeFavorite,
  getFavorites,
  getRecentlyViewed,
};
