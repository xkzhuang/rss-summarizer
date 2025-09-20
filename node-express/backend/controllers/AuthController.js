import AuthService from '../services/AuthService.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

class AuthController {
  /**
   * Register a new user
   */
  static register = asyncHandler(async (req, res) => {

    const { username, email, password, role } = req.body;
    
    const user = await AuthService.register({
      username,
      email,
      password,
      role,
    }, req.transaction);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user },
    });
  });

  /**
   * Login user
   */
  static login = asyncHandler(async (req, res) => {

    const { identifier, password, rememberMe } = req.body;
    
    const result = await AuthService.login({ identifier, password, rememberMe });

    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  });

  /**
   * Refresh JWT token
   */
  static refreshToken = asyncHandler(async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    const result = await AuthService.refreshToken(token);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  });

  /**
   * Get current user profile
   */
  static getProfile = asyncHandler(async (req, res) => {
    const user = await AuthService.getUserById(req.user.id);

    res.json({
      success: true,
      data: { user },
    });
  });

  /**
   * Update user profile
   */
  static updateProfile = asyncHandler(async (req, res) => {

    const { username, email } = req.body;
    
    const user = await AuthService.updateProfile(
      req.user.id,
      { username, email },
      req.transaction
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  });

  /**
   * Change password
   */
  static changePassword = asyncHandler(async (req, res) => {

    const { currentPassword, newPassword } = req.body;
    
    await AuthService.changePassword(
      req.user.id,
      currentPassword,
      newPassword,
      req.transaction
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  });

  /**
   * Set OpenAI API key
   */
  static setOpenAIKey = asyncHandler(async (req, res) => {

    const { apiKey } = req.body;
    
    await AuthService.setOpenAIKey(req.user.id, apiKey, req.transaction);

    res.json({
      success: true,
      message: 'OpenAI API key updated successfully',
    });
  });

  /**
   * Delete user account
   */
  static deleteAccount = asyncHandler(async (req, res) => {

    const { password } = req.body;
    
    await AuthService.deleteAccount(req.user.id, password, req.transaction);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  });

  /**
   * Search users (admin only)
   */
  static searchUsers = asyncHandler(async (req, res) => {
    const { q: query = '', limit = 20, offset = 0 } = req.query;
    
    const result = await AuthService.searchUsers(
      query,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: result,
    });
  });

  /**
   * Get user by ID (admin or own profile)
   */
  static getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    // Users can only access their own profile unless they're admin
    if (req.user.role !== 'admin' && parseInt(userId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const user = await AuthService.getUserById(userId);

    res.json({
      success: true,
      data: { user },
    });
  });

  /**
   * Logout (client-side token invalidation)
   */
  static logout = asyncHandler(async (req, res) => {
    // Since we're using stateless JWT, logout is handled client-side
    // This endpoint exists for consistency and potential future enhancements
    res.json({
      success: true,
      message: 'Logout successful',
    });
  });
}

export default AuthController;