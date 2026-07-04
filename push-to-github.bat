@echo off
cd /d "C:\Users\ameen\dev\water-billing"
echo Pushing your code to GitHub...
echo A GitHub sign-in window may pop up - approve it.
echo.
git push -u origin main
echo.
echo ==========================================
echo Done. If it says "branch 'main' set up to track", it worked.
echo ==========================================
pause
