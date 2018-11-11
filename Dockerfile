FROM node:10

RUN mkdir /app
WORKDIR /app

COPY package.json .
RUN npm install --quiet

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
