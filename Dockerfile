# Sử dụng Node.js chính thức
FROM node:18

# Tạo thư mục làm việc
WORKDIR /app

# Copy toàn bộ mã nguồn vào container
COPY . .

# Cài đặt các gói phụ thuộc
RUN npm install

# Mở port 3000 để truy cập server
EXPOSE 3000

# Lệnh chạy khi container khởi động
CMD ["node", "server.js"]
