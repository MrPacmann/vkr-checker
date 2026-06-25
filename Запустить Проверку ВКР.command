#!/bin/zsh

cd "$(dirname "$0")" || exit 1

echo "Проверка оформления учебных работ"
echo "Сайт будет работать, пока открыто это окно терминала."
echo "Чтобы остановить сайт, закройте окно или нажмите Ctrl+C."
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "npm не найден. Установите Node.js: https://nodejs.org/"
  echo
  read -r "?Нажмите Enter, чтобы закрыть окно..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Пакеты не установлены. Выполняю npm install..."
  npm install || {
    echo
    echo "Не удалось установить зависимости."
    read -r "?Нажмите Enter, чтобы закрыть окно..."
    exit 1
  }
  echo
fi

echo "Открываю сайт: http://127.0.0.1:5173/"
open "http://127.0.0.1:5173/" >/dev/null 2>&1 &
echo

npm run dev -- --host 127.0.0.1

echo
read -r "?Сервер остановлен. Нажмите Enter, чтобы закрыть окно..."
