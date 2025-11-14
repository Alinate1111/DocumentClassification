import psycopg2
from psycopg2.extras import RealDictCursor
from passlib.context import CryptContext
from typing import Optional
from core.db_conn import PostgresDB

# 비밀번호 암호화
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# DB 커넥션 풀 생성
db = PostgresDB()

# 1️⃣ 회원 추가 (INSERT)
def add_member(id: str, password: str, name: str, phone: str, email: str,
               member_role: str = 'R2', member_grade: str = 'G2') -> int:
    """
    회원 추가 후 생성된 member_id 반환
    비밀번호는 bcrypt로 암호화해서 저장
    """
    # 비밀번호 안전하게 해싱
    encoded = password.encode('utf-8')
    if len(encoded) > 72:
        encoded = encoded[:72]
        while True:
            try:
                password = encoded.decode('utf-8')
                break
            except UnicodeDecodeError:
                encoded = encoded[:-1]

    hashed_password = pwd_context.hash(password)

    query = """
        INSERT INTO member_info (id, password, name, phone, email, member_role, member_grade)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING member_id;
    """
    conn = db.get_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (id, hashed_password, name, phone, email, member_role, member_grade))
                member_id = cur.fetchone()['member_id']

            # member_log 초기화
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO member_log (member_id, create_date, update_date, date_of_connection, access_count)
                    VALUES (%s, CURRENT_TIMESTAMP, NULL, NULL, 0)
                """, (member_id,))
        return member_id
    finally:
        db.release_conn(conn)


# 2️⃣ 회원 정보 수정 (UPDATE)
def update_member(
    id: str,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    member_role: Optional[str] = None,
    member_grade: Optional[str] = None
) -> bool:
    """
    회원 정보 수정
    변경할 값이 None인 경우 해당 필드는 변경되지 않음
    비밀번호 변경 시 bcrypt 해싱 적용
    """
    fields = []
    values = []

    if name:
        fields.append("name = %s")
        values.append(name)
    if phone:
        fields.append("phone = %s")
        values.append(phone)
    if email:
        fields.append("email = %s")
        values.append(email)
    if password:
        # 비밀번호 길이 제한 처리
        encoded = password.encode('utf-8')
        if len(encoded) > 72:
            encoded = encoded[:72]
            while True:
                try:
                    password = encoded.decode('utf-8')
                    break
                except UnicodeDecodeError:
                    encoded = encoded[:-1]

        hashed_password = pwd_context.hash(password)
        fields.append("password = %s")
        values.append(hashed_password)

    if member_role:
        fields.append("member_role = %s")
        values.append(member_role)
    if member_grade:
        fields.append("member_grade = %s")
        values.append(member_grade)

    if not fields:
        return False  # 변경할 값이 없으면 수행 안함

    query = f"UPDATE member_info SET {', '.join(fields)} WHERE id = %s"
    values.append(id)

    conn = db.get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(query, values)
                return cur.rowcount > 0
    finally:
        db.release_conn(conn)


# 3️⃣ 회원 삭제 (DELETE)
def delete_member(id: str) -> bool:
    """
    회원 삭제, 로그도 함께 삭제
    """
    conn = db.get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                # member_log 삭제
                cur.execute("""
                    DELETE FROM member_log
                    WHERE member_id = (SELECT member_id FROM member_info WHERE id = %s)
                """, (id,))
                # member_info 삭제
                cur.execute("DELETE FROM member_info WHERE id = %s", (id,))
                return cur.rowcount > 0
    finally:
        db.release_conn(conn)


# 4️⃣ 회원 정보 조회 (SELECT)
def get_member_by_id(member_id: str):
    query = """
        SELECT id, name, phone, email
        FROM member_info
        WHERE member_id = %s
    """
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (member_id,))
            return cur.fetchone()
    finally:
        db.release_conn(conn)


# 5️⃣ USER 회원 수 조회
def get_total_member_count() -> int:
    """
    member_role이 'R2'인 회원 수를 반환
    """
    query = "SELECT COUNT(*) AS total FROM member_info WHERE member_role = 'R2'"
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query)
            result = cur.fetchone()
            return result['total'] if result else 0
    finally:
        db.release_conn(conn)

