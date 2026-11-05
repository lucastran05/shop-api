import catalogRepository from '../modules/catalog/catalog.repository.js';
import { BadRequestError } from '../common/errors/AppError.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class ReviewController {
  // GET /api/v1/products/:product_id/reviews (REV01)
  static getReviews = asyncHandler(async (req, res) => {
    const product_id = req.params.product_id || req.params.id;
    const { page, limit } = req.query;

    const result = await catalogRepository.getReviews(product_id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      userId: req.user?.id || null,
    });

    return res.status(200).json({
      status: 'success',
      data: result.reviews,
      summary: result.summary,
      pagination: result.pagination,
      user_eligibility: result.user_eligibility,
    });
  });

  // GET /api/v1/products/:product_id/reviews/eligibility
  static checkEligibility = asyncHandler(async (req, res) => {
    const product_id = req.params.product_id || req.params.id;
    const result = await catalogRepository.checkReviewEligibility(product_id, req.user.id);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  });

  // POST /api/v1/products/:product_id/reviews (REV02)
  static createReview = asyncHandler(async (req, res) => {
    const product_id = req.params.product_id || req.params.id;
    const { rating, content, image_ids } = req.body;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      throw new BadRequestError('Điểm đánh giá phải từ 1 đến 5 sao');
    }

    if (content && content.length > 1000) {
      throw new BadRequestError('Nội dung đánh giá không được vượt quá 1000 ký tự');
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
  });
}

export default ReviewController;
