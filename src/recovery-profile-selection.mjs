export function normalizeTargetProfile(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "default") {
    return "prod";
  }
  return normalized === "prod" || normalized === "stage" ? normalized : null;
}

export function inferTargetProfileFromBridgeUrl(value, profiles = []) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    const parsed = new URL(value);
    const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
    const matchedProfile = profiles.find(
      (profile) => Number(profile?.bridgePort) === port && typeof profile?.id === "string",
    );
    return matchedProfile?.id || null;
  } catch {
    return null;
  }
}

export function requestedBridgeProfileId(body, profiles = []) {
  return (
    normalizeTargetProfile(body?.targetProfile)
    || inferTargetProfileFromBridgeUrl(body?.bridgeUrl, profiles)
    || null
  );
}

export function resolveAuthorizedBridgeProfile(authToken, body, availableProfiles) {
  if (!authToken) {
    return {
      ok: false,
      status: 401,
      error: { code: "unauthorized", message: "Unauthorized" },
    };
  }

  const authorizedProfiles = availableProfiles.filter(
    (profile) => typeof profile?.token === "string" && profile.token && profile.token === authToken,
  );
  if (authorizedProfiles.length === 0) {
    return {
      ok: false,
      status: 401,
      error: { code: "unauthorized", message: "Unauthorized" },
    };
  }

  const requestedProfileId = requestedBridgeProfileId(body, authorizedProfiles);
  if (requestedProfileId) {
    const requestedProfile = authorizedProfiles.find((profile) => profile.id === requestedProfileId);
    if (!requestedProfile) {
      return {
        ok: false,
        status: 400,
        error: {
          code: "target_profile_unavailable",
          message: `Requested host-control target profile ${requestedProfileId} is not available for this recovery token.`,
        },
      };
    }
    return { ok: true, profile: requestedProfile };
  }

  if (authorizedProfiles.length > 1) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "target_profile_required",
        message:
          "Recovery token matches multiple host-control bridge profiles. Specify targetProfile or bridgeUrl.",
      },
    };
  }

  return { ok: true, profile: authorizedProfiles[0] };
}
