# WorkflowAI

A full-stack AI-powered workflow management system for Jay's Frames custom framing business.

## Features

- **Order Management** - Track custom framing orders through their entire lifecycle
- **Customer Portal** - Allow customers to track their orders in real-time
- **Analytics Dashboard** - Monitor business performance and workload
- **Material Ordering** - Automated vendor integration and material tracking
- **Time Tracking** - Track employee hours and project time
- **AI Insights** - Get intelligent recommendations for workflow optimization
- **Notifications** - Automated email/SMS notifications for order updates
- **Invoice Management** - Generate and track invoices

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js
- **AI**: OpenAI integration
- **Communication**: Twilio (SMS), SendGrid (Email)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

## Environment Variables

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `TWILIO_*` - Twilio credentials for SMS
- `SENDGRID_API_KEY` - SendGrid API key for email

## Deployment

This project is configured for deployment on Railway. Push to the main branch to trigger automatic deployment.

## License

MIT
