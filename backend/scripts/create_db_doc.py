import psycopg2  
def docfile(n):
    sql = f"""
    CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        text_ocr_content TEXT NOT NULL,
        category1 VARCHAR(100),
        category2 VARCHAR(100),
        category3 VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO documents (text_ocr_content, category1,category2,category3)
    VALUES ('문서 내용 부분입니다 여기에다가는 ocr값을 넣을겁니다', '{n}-1카테고리','{n}-2카테고리','{n}-3카테고리')
    RETURNING id;
    """
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user="postgres",
            password="1234",
            host="localhost",
            port="5432"
        )
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        cur.close()
        conn.close()
        print(f"✅ 테이블  이(가) 생성되었습니다.")
    except Exception as e:
        print("❌ 오류 발생:", e)

for docint in range(0,10):
    print(docfile(docint))