@echo off
rem ---------------------------------------------------------------
rem  Generador de ejercicios (atajo de: node tools/generar.js ...)
rem
rem  Uso corto:   generar [cantidad] [dificultad] [semilla]
rem     generar                    -> 1 ejercicio, dificultad media, semilla al azar
rem     generar 10                 -> 10 ejercicios
rem     generar 10 dificil         -> 10 ejercicios dificiles
rem     generar 5 facil 42         -> 5 ejercicios faciles desde la semilla 42
rem
rem  Uso completo (se pasa tal cual a tools/generar.js):
rem     generar --n 10 --dificultad media --formas 6-9 --modelos 4 --tipos rectangulo,circulo,hexagono
rem     generar --help
rem
rem  dificultad: facil | media | dificil
rem  Los archivos quedan en public\ejemplos\ y aparecen en Archivo > Abrir ejemplo > Generados.
rem ---------------------------------------------------------------
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org y volve a probar.
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias, una sola vez...
  call npm install || exit /b 1
)

rem Con opciones (--algo) se pasa todo directo
set "A=%~1"
if "%A:~0,1%"=="-" (
  node tools\generar.js %*
  exit /b %errorlevel%
)

rem Uso corto: cantidad, dificultad, semilla
set "N=%~1"
if "%N%"=="" set "N=1"
set "D=%~2"
if "%D%"=="" set "D=media"
set "CMD=node tools\generar.js --n %N% --dificultad %D%"
if not "%~3"=="" set "CMD=%CMD% --seed %~3"
%CMD%
exit /b %errorlevel%
