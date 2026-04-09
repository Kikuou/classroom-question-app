export function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("qapp_client_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("qapp_client_id", id);
  }
  return id;
}
