-- 客人邮箱 —— 订单状态通知用。
--
-- 为什么需要:定点配送的订单会因为未成团被取消,这件事必须通知到人。原先只靠
-- 微信群通知,但不在群里的客人一样能下单,他们的卡被冻结又被解除,却什么都收不到。
-- 邮箱是唯一一个「下单就能拿到、且不依赖客人装什么 App」的联系方式。
--
-- 允许为空:历史订单没有这个字段,回填不了;新单在前端和 create-checkout 里都是必填。
alter table orders
  add column if not exists customer_email text;

-- 按邮箱查客人的历史订单(客服场景:「我上周那单呢」)
create index if not exists orders_email_idx on orders (customer_email);
