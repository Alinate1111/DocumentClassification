interface FilteringProgressProps {
  onCancel?: () => void;
}

export function FilteringProgress({ onCancel }: FilteringProgressProps) {
  return (
    <div style={{ width: '1384px', height: '844px', position: 'relative', background: '#F7F8FA', margin: '0 auto' }}>
      <div style={{ width: '1336px', height: '415px', left: '24px', top: '24px', position: 'absolute', background: 'white', borderRadius: '6px' }}>
        <div style={{ width: '1288px', height: '36px', left: '24px', top: '87px', position: 'absolute' }}>
          <div style={{ width: '204.67px', height: '34px', left: '114.31px', top: '1px', position: 'absolute', background: '#4A6A85', borderRadius: '2px' }}>
            <div style={{ left: '16px', top: '8px', position: 'absolute', color: 'white', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>카테고리 편집 및 샘플 문서 등록</div>
          </div>
          <div style={{ width: '258.02px', height: '36px', left: '346.98px', top: '0px', position: 'absolute', borderRadius: '2px', border: '1px #CCCCCC solid' }}>
            <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>미분류 문서 카테고리 자동 생성 여부 선택</div>
          </div>
          <div style={{ left: '326.98px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>▶</div>
          <div style={{ left: '613px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>▶</div>
          <div style={{ width: '179.34px', height: '36px', left: '633px', top: '0px', position: 'absolute', borderRadius: '2px', border: '1px #CCCCCC solid' }}>
            <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>카테고리 생성 및 문서 분류</div>
          </div>
          <div style={{ width: '168.67px', height: '36px', left: '840.34px', top: '0px', position: 'absolute', borderRadius: '2px', border: '1px #CCCCCC solid' }}>
            <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>카테고리 전문가 DB 생성</div>
          </div>
          <div style={{ width: '136.67px', height: '36px', left: '1037.02px', top: '0px', position: 'absolute', borderRadius: '2px', border: '1px #CCCCCC solid' }}>
            <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>카테고리 생성 완료</div>
          </div>
          <div style={{ left: '820.34px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>▶</div>
          <div style={{ left: '1017.02px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>▶</div>
        </div>
        <div style={{ width: '1288px', height: '220px', left: '24px', top: '171px', position: 'absolute' }}>
          <div style={{ width: '120px', height: '100px', left: '584px', top: '0px', position: 'absolute', overflow: 'hidden' }}>
            <div style={{ width: '120px', height: '100px', left: '0px', top: '0px', position: 'absolute', background: '#DDDDDD', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #999999', borderTopColor: '#333333', borderRadius: '50%' }}></div>
            </div>
          </div>
          <div
            onClick={onCancel}
            style={{ width: '74px', height: '26px', left: '607px', top: '194px', position: 'absolute', borderRadius: '2px', border: '1px #CCCCCC solid', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>취소</div>
          </div>
          <div style={{ left: '506.33px', top: '116px', position: 'absolute', color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word' }}>샘플 문서 필터링 작업을 진행하고 있습니다.</div>
          <div style={{ width: '381.02px', height: '31px', left: '453.98px', top: '147.50px', position: 'absolute' }}>
            <span style={{ color: '#999999', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word' }}>AI가 카테고리에 등록된 샘플 문서들을 비교하여 부적합한 샘플 문서를 찾고 있습니다.</span>
            <span style={{ color: 'black', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word' }}> <br /></span>
            <span style={{ color: '#999999', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word' }}>작업이 완료되면 필터링 결과 관리 화면으로 이동합니다.</span>
            <span style={{ color: 'black', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word' }}> </span>
          </div>
        </div>
        <div style={{ left: '24px', top: '24px', position: 'absolute', color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 구동 상황</div>
        <div style={{ left: '24px', top: '48px', position: 'absolute', color: '#999999', fontSize: '10px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '15px', wordWrap: 'break-word' }}>관리자가 카테고리를 수동으로 생성하고, AI가 자동으로 문서를 분류합니다.</div>
      </div>
    </div>
  );
}
