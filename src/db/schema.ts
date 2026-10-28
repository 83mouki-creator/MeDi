/**
 * MeDi — schéma relationnel PostgreSQL (Neon).
 *
 * Conventions :
 *  - montants : numeric(12,2), jamais de flottant (l'application manipule des entiers FCFA)
 *  - stock : `stock` = physique, `reserved` = réservé par des commandes en cours
 *    => disponible = stock - reserved (garanti >= 0 par contrainte)
 *  - les colonnes sont générées en snake_case (casing: 'snake_case' dans drizzle.config.ts)
 */
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', [
  'CUSTOMER',
  'STOCK_MANAGER',
  'ORDER_MANAGER',
  'ADMIN',
  'OWNER',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'PENDING_CONFIRMATION',
  'AWAITING_PAYMENT',
  'AWAITING_PAYMENT_VERIFICATION',
  'PAYMENT_CONFIRMED',
  'PREPARING',
  'READY_TO_SHIP',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'UNPAID',
  'AWAITING_VERIFICATION',
  'PAID',
  'FAILED',
  'REFUNDED',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'WAVE',
  'CASH_ON_DELIVERY',
  'CASH_IN_STORE',
]);

export const deliveryMethodEnum = pgEnum('delivery_method', ['PICKUP', 'LOCAL_DELIVERY', 'CARRIER']);

export const movementTypeEnum = pgEnum('movement_type', [
  'INITIAL',
  'RESTOCK',
  'RESERVATION',
  'RELEASE',
  'SALE',
  'ADJUSTMENT',
  'RETURN',
]);

export const paymentProviderEnum = pgEnum('payment_provider', ['WAVE', 'CASH', 'MANUAL']);

export const paymentRecordStatusEnum = pgEnum('payment_record_status', [
  'PENDING',
  'AWAITING_VERIFICATION',
  'CONFIRMED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
]);

export const shipmentStatusEnum = pgEnum('shipment_status', [
  'PENDING',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'RETURNED',
]);

export const promotionTypeEnum = pgEnum('promotion_type', ['PERCENT', 'FIXED', 'FREE_SHIPPING']);

// ───────────────────────────── Utilisateurs & sécurité ─────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    phone: text('phone'),
    role: roleEnum('role').notNull().default('CUSTOMER'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_key').on(t.email), index('users_role_idx').on(t.role)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sessions_token_hash_key').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('password_reset_token_hash_key').on(t.tokenHash), index('password_reset_user_idx').on(t.userId)],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    ip: text('ip'),
    success: boolean('success').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('login_attempts_email_idx').on(t.email, t.createdAt), index('login_attempts_ip_idx').on(t.ip, t.createdAt)],
);

export const addresses = pgTable(
  'addresses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label'),
    recipientName: text('recipient_name').notNull(),
    phone: text('phone').notNull(),
    city: text('city').notNull(),
    commune: text('commune'),
    addressLine: text('address_line').notNull(),
    landmark: text('landmark'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('addresses_user_idx').on(t.userId)],
);

// ───────────────────────────── Catalogue ─────────────────────────────

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    position: integer('position').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    parentId: text('parent_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('categories_slug_key').on(t.slug), index('categories_parent_idx').on(t.parentId)],
);

export const brands = pgTable(
  'brands',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('brands_slug_key').on(t.slug)],
);

export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  contact: text('contact'),
  phone: text('phone'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    sku: text('sku').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    shortDescription: text('short_description'),
    description: text('description'),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    promoPrice: numeric('promo_price', { precision: 12, scale: 2 }),
    promoStartsAt: timestamp('promo_starts_at', { withTimezone: true }),
    promoEndsAt: timestamp('promo_ends_at', { withTimezone: true }),
    stock: integer('stock').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold'),
    allowPreorder: boolean('allow_preorder').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    isArchived: boolean('is_archived').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),
    soldCount: integer('sold_count').notNull().default(0),
    warranty: text('warranty'),
    searchText: text('search_text').notNull().default(''),
    keywords: text('keywords').array().notNull().default([]),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    brandId: text('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('products_sku_key').on(t.sku),
    uniqueIndex('products_slug_key').on(t.slug),
    index('products_category_idx').on(t.categoryId),
    index('products_brand_idx').on(t.brandId),
    index('products_active_idx').on(t.isActive, t.isArchived),
    index('products_price_idx').on(t.price),
    index('products_created_idx').on(t.createdAt),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    publicId: text('public_id'),
    alt: text('alt'),
    position: integer('position').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    checksum: text('checksum'),
    embedding: jsonb('embedding').$type<number[] | null>(),
    embeddingModel: text('embedding_model'),
    embeddingDim: integer('embedding_dim'),
    embeddingAt: timestamp('embedding_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('product_images_product_idx').on(t.productId),
    uniqueIndex('product_images_checksum_key').on(t.checksum),
  ],
);

export const productAttributes = pgTable(
  'product_attributes',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    value: text('value').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('product_attributes_product_idx').on(t.productId)],
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    type: movementTypeEnum('type').notNull(),
    quantity: integer('quantity').notNull(),
    stockAfter: integer('stock_after').notNull(),
    reservedAfter: integer('reserved_after').notNull(),
    orderId: text('order_id'),
    reason: text('reason'),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('inventory_movements_product_idx').on(t.productId, t.createdAt), index('inventory_movements_order_idx').on(t.orderId)],
);

// ───────────────────────────── Commandes ─────────────────────────────

export const deliveryZones = pgTable(
  'delivery_zones',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    city: text('city').notNull(),
    isLocal: boolean('is_local').notNull().default(false),
    isPickup: boolean('is_pickup').notNull().default(false),
    fee: numeric('fee', { precision: 12, scale: 2 }).notNull(),
    freeAbove: numeric('free_above', { precision: 12, scale: 2 }),
    estimatedDelay: text('estimated_delay'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('delivery_zones_city_idx').on(t.city)],
);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    number: text('number').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    customerFirstName: text('customer_first_name').notNull(),
    customerLastName: text('customer_last_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    deliveryMethod: deliveryMethodEnum('delivery_method').notNull(),
    zoneId: text('zone_id').references(() => deliveryZones.id, { onDelete: 'set null' }),
    city: text('city').notNull(),
    commune: text('commune'),
    addressLine: text('address_line'),
    landmark: text('landmark'),
    carrier: text('carrier'),
    trackingNumber: text('tracking_number'),
    shippingFee: numeric('shipping_fee', { precision: 12, scale: 2 }).notNull().default('0'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('UNPAID'),
    status: orderStatusEnum('status').notNull().default('PENDING_CONFIRMATION'),
    stockCommitted: boolean('stock_committed').notNull().default(false),
    reservationExpiresAt: timestamp('reservation_expires_at', { withTimezone: true }),
    customerNote: text('customer_note'),
    adminNote: text('admin_note'),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    accessToken: text('access_token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_number_key').on(t.number),
    uniqueIndex('orders_access_token_key').on(t.accessToken),
    index('orders_status_idx').on(t.status),
    index('orders_payment_status_idx').on(t.paymentStatus),
    index('orders_created_idx').on(t.createdAt),
    index('orders_phone_idx').on(t.phone),
    index('orders_user_idx').on(t.userId),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
    // Snapshot : la commande ne change jamais de prix rétroactivement.
    skuSnapshot: text('sku_snapshot').notNull(),
    nameSnapshot: text('name_snapshot').notNull(),
    imageSnapshot: text('image_snapshot'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    quantity: integer('quantity').notNull(),
    lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId), index('order_items_product_idx').on(t.productId)],
);

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    status: paymentRecordStatusEnum('status').notNull().default('PENDING'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('XOF'),
    clientReference: text('client_reference').notNull(),
    providerSessionId: text('provider_session_id'),
    providerTransactionId: text('provider_transaction_id'),
    launchUrl: text('launch_url'),
    customerReference: text('customer_reference'),
    confirmedById: text('confirmed_by_id').references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payments_client_reference_key').on(t.clientReference),
    uniqueIndex('payments_provider_session_key').on(t.providerSessionId),
    uniqueIndex('payments_provider_transaction_key').on(t.providerTransactionId),
    index('payments_order_idx').on(t.orderId),
    index('payments_status_idx').on(t.status),
  ],
);

export const shipments = pgTable(
  'shipments',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    carrier: text('carrier'),
    trackingNumber: text('tracking_number'),
    fee: numeric('fee', { precision: 12, scale: 2 }).notNull().default('0'),
    status: shipmentStatusEnum('status').notNull().default('PENDING'),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shipments_order_idx').on(t.orderId)],
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum('from_status'),
    toStatus: orderStatusEnum('to_status').notNull(),
    note: text('note'),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorLabel: text('actor_label').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_status_history_order_idx').on(t.orderId, t.createdAt)],
);

// ───────────────────────────── Promotions & réglages ─────────────────────────────

export const promotions = pgTable(
  'promotions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    type: promotionTypeEnum('type').notNull(),
    value: numeric('value', { precision: 12, scale: 2 }).notNull(),
    code: text('code'),
    minOrderAmount: numeric('min_order_amount', { precision: 12, scale: 2 }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('promotions_code_key').on(t.code), index('promotions_window_idx').on(t.isActive, t.startsAt, t.endsAt)],
);

export const storeSettings = pgTable('store_settings', {
  id: integer('id').primaryKey().default(1),
  storeName: text('store_name').notNull().default('MeDi'),
  tagline: text('tagline'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  addressLine: text('address_line'),
  city: text('city').notNull().default('Daloa'),
  country: text('country').notNull().default("Côte d'Ivoire"),
  openingHours: text('opening_hours'),
  waveNumber: text('wave_number'),
  waveMerchantName: text('wave_merchant_name'),
  waveMode: text('wave_mode').notNull().default('MANUAL'),
  allowCod: boolean('allow_cod').notNull().default(false),
  codMaxAmount: numeric('cod_max_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  allowPickup: boolean('allow_pickup').notNull().default(true),
  allowLocalDelivery: boolean('allow_local_delivery').notNull().default(true),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  reservationMinutes: integer('reservation_minutes').notNull().default(120),
  freeDeliveryAbove: numeric('free_delivery_above', { precision: 12, scale: 2 }),
  facebookUrl: text('facebook_url'),
  instagramUrl: text('instagram_url'),
  legalNotice: text('legal_notice'),
  returnPolicy: text('return_policy'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ───────────────────────────── Journalisation ─────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    metadata: jsonb('metadata'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_created_idx').on(t.createdAt),
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
    index('audit_logs_action_idx').on(t.action),
  ],
);

export const searchEvents = pgTable(
  'search_events',
  {
    id: text('id').primaryKey(),
    query: text('query').notNull(),
    resultCount: integer('result_count').notNull(),
    kind: text('kind').notNull().default('TEXT'),
    userId: text('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('search_events_created_idx').on(t.createdAt)],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('webhook_events_provider_event_key').on(t.provider, t.eventId)],
);

// ─── table de travail pour les photos importées en masse, avant affectation ───

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    filename: text('filename').notNull(),
    url: text('url').notNull(),
    checksum: text('checksum').notNull(),
    width: integer('width'),
    height: integer('height'),
    bytes: integer('bytes'),
    status: text('status').notNull().default('PENDING'), // PENDING | ASSIGNED | REJECTED | DUPLICATE
    suggestedSku: text('suggested_sku'),
    productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
    note: text('note'),
    embedding: jsonb('embedding').$type<number[] | null>(),
    embeddingModel: text('embedding_model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('media_assets_checksum_key').on(t.checksum),
    index('media_assets_status_idx').on(t.status),
    index('media_assets_product_idx').on(t.productId),
  ],
);

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type StoreSetting = typeof storeSettings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;


// ─── demandes d'aide / messages du formulaire de contact ───

export const contactMessages = pgTable(
  'contact_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    orderNumber: text('order_number'),
    /** NEW | IN_PROGRESS | CLOSED */
    status: text('status').notNull().default('NEW'),
    handledBy: text('handled_by').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    replyNote: text('reply_note'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('contact_messages_status_idx').on(t.status, t.createdAt),
    index('contact_messages_user_idx').on(t.userId),
  ],
);
