# Usando uma imagem estável do Node.js
FROM node:20-alpine

# Instala dependências necessárias para compilar o módulo sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências (compilando o sqlite3 se necessário)
RUN npm install --omit=dev

# Copia o restante do código
COPY . .

# Cria a pasta onde o SQLite guardará o banco
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
