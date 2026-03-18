export async function listTabs() {
  return {
    available: false,
    message: "browser tab inspection is not implemented yet in the scaffold",
    tabs: [],
  };
}

export async function inspectTab() {
  const err = new Error("browser tab inspection is not implemented yet in the scaffold");
  err.code = "not_implemented";
  throw err;
}
