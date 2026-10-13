import identityRepository from '../modules/identity/identity.repository.js';

class UserModel {
  static async findByEmail(email) {
    return identityRepository.findByEmail(email);
  }

  static async findById(id) {
    return identityRepository.findById(id);
  }

  static async findAll(filters) {
    return identityRepository.findAll(filters);
  }

  static async create(userData) {
    return identityRepository.create(userData);
  }

  static async update(id, fields) {
    return identityRepository.update(id, fields);
  }

  static async delete(id) {
    return identityRepository.delete(id);
  }

  static async updateRefreshToken(id, rf_token) {
    return identityRepository.updateRefreshToken(id, rf_token);
  }

  static async findByRefreshToken(rf_token) {
    return identityRepository.findByRefreshToken(rf_token);
  }

  static async updatePassword(id, hashedPassword) {
    return identityRepository.updatePassword(id, hashedPassword);
  }
}

export default UserModel;
