const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');

// POST /api/products (admin only)
const createProduct = catchAsync(async (req, res) => {
  const { name, category, price, unit, description } = req.body;
  const product = await Product.create({ name, category, price, unit, description });
  return sendSuccess(res, 201, 'Product created successfully', { product });
});

// GET /api/products?category=&search=
const listProducts = catchAsync(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) filter.name = { $regex: req.query.search, $options: 'i' };

  const products = await Product.find(filter).sort({ name: 1 });
  return sendSuccess(res, 200, 'Products fetched', { products });
});

// GET /api/products/:id
const getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError('Product not found', 404, 'NOT_FOUND'));
  return sendSuccess(res, 200, 'Product fetched', { product });
});

// PUT /api/products/:id (admin only)
const updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError('Product not found', 404, 'NOT_FOUND'));

  const allowed = ['name', 'category', 'price', 'unit', 'description', 'isActive'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  });
  await product.save();
  return sendSuccess(res, 200, 'Product updated successfully', { product });
});

// DELETE /api/products/:id (admin only) - soft delete
const deactivateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError('Product not found', 404, 'NOT_FOUND'));
  product.isActive = false;
  await product.save();
  return sendSuccess(res, 200, 'Product deactivated successfully', { product });
});

module.exports = { createProduct, listProducts, getProduct, updateProduct, deactivateProduct };
