# Zaryah - Your Path to Meaningful Gifts

A Next.js e-commerce platform for handmade gifts from passionate artisans.

## Features

- 🎁 Handmade gift marketplace
- 👨‍🎨 Artisan profiles and stories
- 🛒 Shopping cart with gift packaging
- 🚚 Instant delivery options
- 📱 Responsive design
- 🔐 User authentication
- 📊 Admin dashboard
- 🎯 Gift suggester tool
- 📦 Hamper builder

## Tech Stack

- **Frontend**: Next.js 14, React 18
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase PostgreSQL
- **Authentication**: Auth0 (Free up to 25k MAUs)
- **Storage**: Supabase Storage or Cloudinary
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **State Management**: React Context API
- **Notifications**: React Hot Toast
- **Real-time**: Supabase Realtime

## Getting Started

### Prerequisites

1. **Supabase Account**: Create a project at [supabase.com](https://supabase.com)
2. **Auth0 Account**: Create an application at [auth0.com](https://auth0.com)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase credentials
   - Fill in your Auth0 credentials

3. **Set up database**:
   - Go to Supabase SQL Editor
   - Run the SQL from `supabase/schema.sql`
   - Configure Row Level Security policies

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
app/
├── api/                # Next.js API routes (serverless)
│   ├── auth/          # Auth0 handlers
│   ├── products/      # Product endpoints
│   ├── cart/          # Cart endpoints
│   └── ...
├── components/         # React components
├── contexts/          # React context providers
├── lib/               # Utility functions
│   ├── supabase.js    # Supabase client
│   └── auth.js        # Auth helpers
├── admin/             # Admin dashboard pages
├── seller/            # Seller dashboard pages
├── shop/              # Shop pages
├── product/           # Product detail pages
└── globals.css        # Global styles

supabase/
└── schema.sql         # Database schema
```

## Migration Status

This project is being migrated from MongoDB + Express.js to Supabase + Next.js API Routes + Auth0.

- ✅ Supabase schema created
- ✅ Auth0 integration setup
- ✅ Basic API routes created
- 🚧 Frontend components being updated
- 🚧 Real-time features migration in progress

See `MIGRATION_GUIDE.md` and `MIGRATION_SUMMARY.md` for details.

## Environment Variables

See `.env.example` for all required variables. Key variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth0
AUTH0_SECRET=your-secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

See `MIGRATION_GUIDE.md` for detailed setup instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License


supabase/
└── schema.sql         # Database schema
```

## Migration Status

This project is being migrated from MongoDB + Express.js to Supabase + Next.js API Routes + Auth0.

- ✅ Supabase schema created
- ✅ Auth0 integration setup
- ✅ Basic API routes created
- 🚧 Frontend components being updated
- 🚧 Real-time features migration in progress

See `MIGRATION_GUIDE.md` and `MIGRATION_SUMMARY.md` for details.

## Environment Variables

See `.env.example` for all required variables. Key variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth0
AUTH0_SECRET=your-secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

See `MIGRATION_GUIDE.md` for detailed setup instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
