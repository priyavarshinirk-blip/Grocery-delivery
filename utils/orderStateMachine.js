// Central definition of the order lifecycle. Every status transition in the
// app must go through canTransition() so business rules live in one place
// instead of being re-implemented ad hoc in each controller.

const ORDER_STATUSES = Object.freeze({
  PLACED: 'PLACED',
  PICKING: 'PICKING',
  PACKED: 'PACKED',
  ASSIGNED: 'ASSIGNED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
});

// Adjacency list of legal forward transitions.
const TRANSITIONS = Object.freeze({
  PLACED: ['PICKING', 'FAILED'],
  PICKING: ['PACKED', 'FAILED'],
  PACKED: ['ASSIGNED', 'FAILED'],
  ASSIGNED: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
});

// Which role(s) are allowed to perform a given transition. 'admin' is
// implicitly always allowed and is checked separately in the controller.
const TRANSITION_ROLES = Object.freeze({
  'PLACED->PICKING': ['store_staff'],
  'PLACED->FAILED': ['customer', 'store_staff'], // customer cancel / staff reject
  'PICKING->PACKED': ['store_staff'],
  'PICKING->FAILED': ['store_staff'],
  'PACKED->ASSIGNED': ['store_staff'], // via the dedicated assign endpoint
  'PACKED->FAILED': ['store_staff'],
  'ASSIGNED->OUT_FOR_DELIVERY': ['delivery_partner'],
  'ASSIGNED->FAILED': ['store_staff'],
  'OUT_FOR_DELIVERY->DELIVERED': ['delivery_partner'],
  'OUT_FOR_DELIVERY->FAILED': ['delivery_partner'],
});

function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

function isRoleAllowed(from, to, role) {
  if (role === 'admin') return true; // admin can force any legal transition
  const key = `${from}->${to}`;
  const allowedRoles = TRANSITION_ROLES[key];
  return Array.isArray(allowedRoles) && allowedRoles.includes(role);
}

function isTerminal(status) {
  return TRANSITIONS[status] && TRANSITIONS[status].length === 0;
}

module.exports = { ORDER_STATUSES, TRANSITIONS, canTransition, isRoleAllowed, isTerminal };
