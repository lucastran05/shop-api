import catalogRepository from '../modules/catalog/catalog.repository.js';

class ReviewController {
  // GET /api/v1/products/:product_id/reviews (REV01)
  static async getReviews(req, res, next) {
    try {
      const { product_id } = req.params;
      const { page, limit } = req.query;

      const result = await catalogRepository.getReviews(product_id, {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return res.status(200).json({
        status: 'success',
        data: result.reviews,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/products/:product_id/reviews (REV02)
  static async createReview(req, res, next) {
    try {
      const { product_id } = req.params;
      const { rating, content, image_ids } = req.body;

      if (!rating || Number(rating) < 1 || Number(rating) > 5) {
        return res.status(400).json({
          status: 'error',
          message: 'Điểm đánh giá phải từ 1 đến 5 sao',
        });
      }

      if (content && content.length > 1000) {
        return res.status(400).json({
          status: 'error',
          message: 'Nội dung đánh giá không được vượt quá 1000 ký tự',
        });
      }

      const result = await catalogRepository.createReview(product_id, req.user.id, {
        rating,
        content,
        image_ids,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Gửi đánh giá thành công',
        data: result.review,
        summary: result.summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default ReviewController;
