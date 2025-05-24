# Shift Schedule Manager

A web-based application for managing employee shift preferences and generating optimized schedules.

## 🚀 Quick Setup for GitHub Pages

### Step 1: Create a GitHub Repository
1. Go to [GitHub](https://github.com) and create a new repository
2. Name it something like `shift-scheduler` 
3. Make it public (required for free GitHub Pages)

### Step 2: Upload Files
1. Create these files in your repository:
   - `worker.html` - Worker interface for submitting preferences
   - `admin.html` - Admin dashboard for managing schedules
   - `README.md` - This documentation

2. Copy the code from the artifacts above into each respective file

### Step 3: Enable GitHub Pages
1. Go to your repository Settings
2. Scroll down to "Pages" section
3. Under "Source", select "Deploy from a branch"
4. Choose "main" branch and "/ (root)" folder
5. Click "Save"

### Step 4: Share Links
After GitHub Pages is enabled (takes 5-10 minutes), your links will be:

**Worker Link (share with employees):**
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/worker.html
```

**Admin Link (keep private):**
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/admin.html
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

## 🔐 Security Notes

### Admin Password
- Default admin password is `admin123`
- **IMPORTANT:** Change this in the `admin.html` file before deploying
- Look for the line: `const ADMIN_PASSWORD = 'admin123';`
- Replace with a secure password

### Data Storage
- Currently uses browser localStorage (demo purposes)
- Data is stored locally on each user's browser
- For production use, consider implementing a backend database

## 📋 How It Works

### For Workers:
1. Visit the worker link
2. Enter name and email
3. Select available shifts for 2 weeks
4. Submit preferences
5. Can update preferences anytime before approval

### For Admin:
1. Visit admin link and enter password
2. Review all worker submissions
3. Approve workers you want in the schedule
4. Generate optimized schedule
5. Export schedule as CSV

## ⚙️ Schedule Optimization Rules

The system automatically optimizes schedules based on:

1. **Minimize Night Shifts**: Distributes night shifts as evenly as possible
2. **Maximum 2 Night Shifts Per Week**: No worker can work more than 2 night shifts in any single week
3. **One Shift Per Day**: Workers can only be assigned to one shift per day
4. **No Morning After Night**: If a worker works night shift, they cannot work morning shift the next day
5. **Equal Weekend Premium**: Friday evening to Saturday evening shifts are distributed fairly

## 🎨 Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Visual Calendar**: Easy-to-use grid for selecting shifts
- **Premium Shift Indicators**: Weekend shifts clearly marked
- **Real-time Statistics**: Track submissions and schedule coverage
- **CSV Export**: Download schedules for payroll/HR systems
- **Simple Authentication**: Basic password protection for admin

## 🔧 Customization

### Changing Shift Times
Current shift schedule:
- **Morning**: 07:00-15:00
- **Evening**: 15:00-23:00  
- **Night**: 23:00-07:00

To modify times, edit both HTML files:
- Look for shift labels and time displays
- Update both worker and admin interfaces consistently

### Modifying Premium Days
Change weekend premium logic:
- Look for `day === 5 || day === 6 || day === 12 || day === 13`
- Adjust numbers to change which days are premium

### Styling
- CSS is embedded in each HTML file
- Look for `<style>` sections to modify colors, layout, etc.

## 📱 Mobile Support

Both interfaces are fully responsive and work well on:
- Desktop computers
- Tablets
- Smartphones

## 🆘 Troubleshooting

### GitHub Pages Not Working
- Make sure repository is public
- Check that files are named exactly `worker.html` and `admin.html`
- Wait 10-15 minutes after enabling Pages

### Data Not Saving
- Check browser console for errors
- Ensure localStorage is enabled in browser
- Try in incognito/private mode to test

### Admin Can't Login
- Verify password in `admin.html` file
- Check for typos in password
- Ensure JavaScript is enabled

## 🔮 Future Enhancements

Possible improvements for production use:
- Backend database integration
- Email notifications
- User authentication system
- Advanced reporting features
- Shift trading between workers
- Integration with payroll systems

## 📄 License

This project is open source. Feel free to modify and adapt for your needs.

---

**Questions?** Create an issue in the GitHub repository or modify the code to fit your specific requirements!
