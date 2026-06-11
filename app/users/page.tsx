import { UserInvitePanel } from "@/components/UserInvitePanel";
import { requireAdmin } from "@/lib/auth";
import { getOrganizationUsers } from "@/lib/queries";

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = admin.organizationId ? await getOrganizationUsers(admin.organizationId) : [];

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">Admin only</span>
          <h1>Users</h1>
          <p className="lede">Create accounts for friends, give them a temporary password, and they will reset it on first login.</p>
        </div>
      </section>

      <section className="two-col">
        <UserInvitePanel />
        <div className="panel">
          <h2>{admin.organizationName ?? "Org"} Members</h2>
          <div className="leaderboard">
            {users.map((user) => (
              <div className="leader-row" key={user.id}>
                <div className="leader-main">
                  <span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{user.displayName}</strong>
                    <div className="muted">{user.email}</div>
                  </div>
                </div>
                <div>
                  <span className="pill">{user.role}</span>
                  {user.mustChangePassword ? <span className="pill">must reset</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
