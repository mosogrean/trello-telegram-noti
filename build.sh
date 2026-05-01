docker buildx build \
  --platform linux/amd64 \
  -t mosogrean/trello-telegram-noti:v1.0.2 \
  --push .

  # docker push mosogrean/trello-telegram-noti:tagname