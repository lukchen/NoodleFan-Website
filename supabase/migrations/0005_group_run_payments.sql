-- 定点配送「先授权、成团才扣款」所需的字段。
--
-- 订单状态流转:
--   pending          下单但没走完 Stripe(废弃草稿)
--   authorized       已授权、钱冻在客人卡上 —— 仅定点配送,等成团
--   paid             已扣款(到店自取立即到此;定点配送成团后 capture 到此)
--   preparing/ready/completed   厨房流程,沿用原有
--   cancelled_no_run 未成团,已取消授权,客人零扣费
alter table orders
  add column if not exists pickup_point      text,        -- store / allston / malden
  add column if not exists pickup_point_name text,        -- 显示名,取餐点改名也不影响历史单
  add column if not exists run_date          date,        -- 哪一班车;到店自取为 NULL
  add column if not exists capture_mode      text,        -- manual(先授权) / automatic(立即扣)
  add column if not exists authorized_at     timestamptz,
  add column if not exists captured_at       timestamptz,
  add column if not exists cancelled_at      timestamptz;

-- 后台按「取餐点 + 发车日」统计成团进度,这是最热的查询。
create index if not exists orders_run_idx on orders (pickup_point, run_date, status);

comment on column orders.capture_mode is
  'manual = 下单只授权,成团后由 run-dispatch 扣款; automatic = 下单即扣款(到店自取)';
