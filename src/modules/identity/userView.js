// Thông tin người dùng trả về cho FE: không bao giờ chứa mật khẩu hay refresh token.
export const toUserView = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  role: user.role,
  is_active: user.active !== false,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

// Hồ sơ của chính người đang đăng nhập (kèm địa chỉ mặc định)
export const toProfileView = (user) => ({
  ...toUserView(user),
  default_address_id: user.default_address_id || null,
});
