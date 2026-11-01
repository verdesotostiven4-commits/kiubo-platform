import type {FoodOrderRecord} from "./local-store";

/**
 * Detect a stale unpaid draft left on a table/delivery/takeaway slot after a
 * later independent order for the SAME slot was already charged.
 *
 * Compare immutable createdAt, NOT updatedAt: sync retries can update an old
 * draft long after the later sale. Never suppress a payment/partial balance.
 * This is a presentation/reservation safety filter; it does not erase orders.
 */
export function supersededUnpaidSlotOrder(
  orders:ReadonlyArray<FoodOrderRecord>,order:FoodOrderRecord
):boolean{
  if(order.paymentStatus!=="unpaid"||order.saleId||
     order.status==="cancelled"||order.status==="delivered"||
     !order.tableLabel?.trim()||
     (order.serviceMode!=="table"&&order.serviceMode!=="delivery"&&order.serviceMode!=="takeaway"))return false;
  const created=Date.parse(order.createdAt);
  if(!Number.isFinite(created))return false;
  return orders.some(other=>
    other.id!==order.id&&other.tenantId===order.tenantId&&
    other.branchId===order.branchId&&other.serviceMode===order.serviceMode&&
    other.tableLabel?.trim()===order.tableLabel?.trim()&&
    other.paymentStatus==="paid"&&Boolean(other.saleId)&&
    other.status!=="cancelled"&&
    Number.isFinite(Date.parse(other.createdAt))&&Date.parse(other.createdAt)>created
  );
}
