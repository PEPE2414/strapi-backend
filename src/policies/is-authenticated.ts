// Minimal auth gate for content API routes.
// Returns true if a user is attached to the request (JWT verified).
export default (policyContext: any) => {
  return !!policyContext?.state?.user;
};
