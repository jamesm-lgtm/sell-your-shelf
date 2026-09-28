-- Let a seller tell us what happened to an order.
--
-- Eight sellers explained why they hadn't posted, and every one of them
-- reached us through James's personal phone — SMS or WhatsApp. Three no
-- longer had the book. One had already posted it and the database still read
-- shipped_at: null because there was no way for him to say so.
--
--   Becky:  "Sorry I forgot I had it on here and sold it on Vinted"
--           "I'm not sure how to cancel the sale"
--   Olly:   "I've shipped." — by WhatsApp, because nothing else existed
--
-- There is no in-product way to say any of that. So the largest single cause
-- of failed dispatch is invisible for twelve days and then shows up as a
-- cancellation with no reason attached.
--
-- These columns are where the answer goes. They are deliberately on orders
-- rather than a new table: one order has one outcome, and a join would only
-- make the thing we want to count harder to count.

alter table orders
  add column if not exists seller_response text
    check (seller_response in ('posted', 'no_longer_have', 'problem')),
  add column if not exists seller_response_at timestamptz,
  add column if not exists seller_response_note text;

comment on column orders.seller_response is
  'What the seller told us, in their own words, via the tokenised link in the sale email: posted | no_longer_have | problem. Null means they have not told us anything, which is the state every failed order was in before this existed.';
comment on column orders.seller_response_note is
  'Free text from the "something is wrong" option. The only place a seller can currently describe a fault in their own words without texting the founder.';

create index if not exists orders_seller_response_idx
  on orders (seller_response, seller_response_at)
  where seller_response is not null;
