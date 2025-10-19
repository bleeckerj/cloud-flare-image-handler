# Cloudflare Image Uploader

A simple, modern web application for uploading and managing images using Cloudflare Images. Perfect for hosting images that you need to use in email blasts, websites, or any other online content.

## Features

- 🎯 **Drag & Drop Interface** - Simple file upload with drag and drop support
- � **Folder Organization** - Organize images into folders (email-campaigns, website-images, etc.)
- 🏷️ **Tagging System** - Tag images for easy categorization and searching
- 🔍 **Advanced Search & Filter** - Search by filename, folder, or tags with real-time filtering
- 🖼️ **Dual View Modes** - Switch between grid and list views for different workflows
- 🔗 **URL Management** - Copy image URLs with one click
- 📱 **Responsive Design** - Works great on desktop and mobile devices
- 🗑️ **Image Deletion** - Remove images you no longer need
- 🎨 **Multiple Variants** - Access different image sizes (thumbnail, medium, large)
- 🔄 **Auto-Refresh Gallery** - Gallery automatically updates when new images are uploaded
- ⚡ **Fast CDN Delivery** - Powered by Cloudflare's global CDN

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd cloudflare-image-uploader
npm install
```

### 2. Configure Cloudflare Images

1. **Get your Cloudflare Account ID**:
   - Go to your Cloudflare dashboard
   - Copy the Account ID from the right sidebar

2. **Create an API Token**:
   - Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use "Custom token" template
   - Add permission: **Cloudflare Images:Edit**
   - Account resources: Include your specific account
   - Click "Continue to summary" and "Create Token"
   - Copy the token (you won't see it again!)

3. **Get your Account Hash** (for image URLs):
   - Go to Cloudflare Images in your dashboard
   - Copy the Account Hash from the Images overview page

### 3. Environment Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Cloudflare credentials:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_HASH=your_account_hash_here
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Usage

### Uploading Images
1. **Choose Organization** (Optional):
   - Select an existing folder or create a new one
   - Add tags (comma-separated) like "logo, header, banner"
2. **Upload Images**: Drag and drop image files onto the upload area, or click to select files
3. **Track Progress**: Watch upload progress and see immediate confirmation

### Managing Your Image Library
1. **Browse & Search**: 
   - Use the search box to find images by name, folder, or tags
   - Filter by specific folders or tags using the dropdowns
2. **View Modes**: 
   - **Grid View**: Perfect for browsing and visual selection
   - **List View**: Great for detailed information and bulk operations
3. **Copy URLs**: Click on any image URL to copy it to your clipboard
4. **Delete Images**: Use the trash icon to remove images you no longer need
5. **Image Variants**: Switch between different sizes (thumbnail, medium, large, public)

### Organization Tips
- **Email Campaigns**: Use folder "email-campaigns" with tags like "newsletter", "promo", "header"
- **Website Images**: Use folder "website-images" with tags like "hero", "about", "testimonial"  
- **Social Media**: Use folder "social-media" with tags like "instagram", "facebook", "linkedin"
- **Blog Posts**: Use folder "blog-posts" with tags by topic or date

## Image Variants

Cloudflare automatically creates multiple variants of your images:
- **Public** - Original size, optimized
- **Thumbnail** - Small preview size
- **Medium** - Medium size for web use
- **Large** - Large size for high-quality displays

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add your environment variables in the Vercel dashboard
4. Deploy!

### Other Platforms

This Next.js application can be deployed to any platform that supports Node.js:
- Netlify
- Railway
- Render
- DigitalOcean App Platform

Make sure to set your environment variables on your chosen platform.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **File Handling**: React Dropzone
- **Image Hosting**: Cloudflare Images
- **Language**: TypeScript

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for any purpose.
