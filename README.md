# Product Management App

A modern, full-stack product management application built with Next.js and Supabase. Features role-based access control, real-time data management, and comprehensive audit logging.

## Features

- **Authentication & Authorization**
  - Secure user registration and login
  - Role-based access control (Admin/User)
  - Protected routes and API endpoints

- **Product Management**
  - Full CRUD operations for products
  - Category management
  - Image URL support
  - Soft delete functionality
  - Advanced filtering and sorting

- **Admin Features**
  - Comprehensive audit logging
  - User role management
  - System activity tracking
  - Data restoration capabilities

- **User Experience**
  - Responsive design for all devices
  - Real-time form validation
  - Loading states and error handling
  - Intuitive navigation and UI

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Testing**: Vitest, Testing Library
- **Deployment**: Vercel-ready

## Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd product-management-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Setup

The application expects the following Supabase tables:

- **users** - User profiles with roles
- **products** - Product catalog
- **categories** - Product categories
- **audit_logs** - System activity tracking

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

## User Roles

- **Admin**: Full access to create, edit, delete products and view audit logs
- **User**: Read-only access to browse products

## Project Structure

```
src/
├── app/                    # Next.js app router pages
├── components/             # Reusable UI components
│   ├── ui/                # shadcn/ui components
│   ├── auth-guard.tsx     # Route protection
│   ├── navbar.tsx         # Navigation component
│   └── product-form.tsx   # Product management form
├── lib/                   # Utility functions and types
├── hooks/                 # Custom React hooks
└── __tests__/             # Test files
```

## Testing

The application includes comprehensive test coverage for:

- API endpoints
- Authentication flows
- CRUD operations
- Error handling

Run tests with:

```bash
npm run test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
