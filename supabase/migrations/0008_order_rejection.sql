-- 拒单:店家主动取消一张已经付了钱(或已冻结)的订单,并全额退款。
--
-- 跟 cancelled_no_run 是两件事,所以单独一个状态:
--   cancelled_no_run  这一班没凑够 5 单,系统自动取消 —— 没有人做错什么
--   rejected          店家做不了这一单(缺货、忙不过来、临时停业),主动退钱
-- 混成一个状态的话,「数据」标签里就分不清「需求没凑够」和「我们接不住」,
-- 而这两件事要采取的行动完全相反:一个是多拉人,一个是别超卖。
alter table orders
  add column if not exists reject_reason text,   -- 理由代码,见 _shared/reject-reasons.js
  add column if not exists rejected_at   timestamptz,
  add column if not exists refund_id     text;   -- Stripe 退款 id,对账时能一眼找到那笔

comment on column orders.reject_reason is '拒单理由代码(sold_out / too_busy / closed),文案在 _shared/reject-reasons.js';
