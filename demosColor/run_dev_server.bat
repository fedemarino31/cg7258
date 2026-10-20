@echo off
where vite >nul 2>nul
if %errorlevel%==0 (
    call vite
) else (
    call npx vite
)
