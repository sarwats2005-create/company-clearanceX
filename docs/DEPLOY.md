# Deploying the app

The app runs as a normal Node.js server on **Railway**, with its database on **Neon**. **Cloudflare** only holds the domain and sits in front of Railway. Railway needs no special settings: `pnpm build` builds the app, and `pnpm start` prepares the database and then starts the server.

On every start, `pnpm start` runs `scripts/setup.ts` first:

1. It brings the database tables up to date (the migrations).
2. On the very first start only (when there are no users yet), it creates the owner login and the starting lists. These are the shipping lines, sizes, charge types, vaults and companies. Later starts never add them again, so anything the owner renames stays renamed.

## 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech) in the region closest to Iraq, such as Frankfurt.
2. On the project dashboard, click **Connect** and copy two connection strings:
    - the **pooled** one, whose host contains `-pooler`, for `DATABASE_URL`;
    - the **direct** one, with "Connection pooling" switched off, for `DATABASE_URL_UNPOOLED`.

## 2. App (Railway)

1. At [railway.com](https://railway.com), choose **New Project → Deploy from GitHub repo**, then pick this repository and the `main` branch.
2. Open the service, go to **Variables**, and add:

    | Variable                | Value                                                       |
    | ----------------------- | ----------------------------------------------------------- |
    | `DATABASE_URL`          | Neon pooled connection string                               |
    | `DATABASE_URL_UNPOOLED` | Neon direct connection string                               |
    | `OWNER_USERNAME`        | The owner's login name, for example `admin`                 |
    | `OWNER_PASSWORD`        | A strong password, 8 characters or more                     |
    | `OWNER_NAME`            | The owner's name as shown in the app, for example `أبو علي` |
    | `TZ`                    | `Asia/Baghdad`                                              |

3. Railway builds and starts the app. The deploy log should show `seed complete: owner login and starting lists created` the first time, and `database already set up; seed skipped` after that.
4. Under **Settings → Networking**, click **Generate Domain** to get a `*.up.railway.app` address and check that the login page opens.

The owner password only matters for the first start. After that, the owner changes it in the app under Settings, and the variable is ignored.

## 3. Your domain (Cloudflare)

1. In Railway, go to **Settings → Networking → Custom Domain** and enter the domain, for example `app.example.com`. Railway shows a CNAME target.
2. In Cloudflare, go to **DNS** and add a `CNAME` record from that name to Railway's target, with the orange-cloud proxy on.
3. In Cloudflare, go to **SSL/TLS** and set the mode to **Full**. "Flexible" causes an endless redirect.

Do not deploy this app as a Cloudflare Worker. It needs a long-running Node.js server and a direct database connection. If a Worker was created from this repository, delete it under **Workers & Pages**, or it will try to build on every push and fail.

## Sample data for a demo

To show the app with sample data, use a **separate** Neon database, never the client's real one. With `DATABASE_URL` pointing at it, run `pnpm start` once (or deploy it), then `pnpm db:demo`. That adds 10 traders and 30 containers, and it refuses a database that already has containers.

## Health check

`/api/health` answers `{"ok":true}` when the app is up and the database responds. You can set it as the health check path in Railway (**Settings → Deploy**) if you like. It is optional.
