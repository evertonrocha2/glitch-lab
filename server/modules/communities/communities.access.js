// Who may do what in a community, in one place. A membership is { role } or null.
export const isMember = (membership) => membership?.role === 'owner' || membership?.role === 'member'
export const isOwner = (membership) => membership?.role === 'owner'

// Every community is public for now; a private one would show its chat to members only.
export const canReadCommunity = (community, membership) => !community.isPrivate || isMember(membership)
