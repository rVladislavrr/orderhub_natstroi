FROM nginx:alpine

# Удаляем дефолтную конфигурацию
RUN rm /etc/nginx/nginx.conf

# Копируем нашу простую конфигурацию
COPY nginx.conf /etc/nginx/nginx.conf

# НЕ проверяем конфигурацию здесь, так как backend и frontend ещё не запущены
# Проверка произойдёт при запуске контейнера

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]