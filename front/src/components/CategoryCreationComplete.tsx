import { useState } from 'react';

interface CategoryCreationCompleteProps {
  onConfirm?: () => void;
}

export function CategoryCreationComplete({ onConfirm }: CategoryCreationCompleteProps) {
  return (
    <div style={{ width: '1440px', height: '802px', position: 'relative' }}>
      <div style={{ width: '1336px', height: '754px', left: '80px', top: '24px', position: 'absolute', background: 'white', borderRadius: '6px' }}>
        <div style={{ width: '1288px', height: '503px', left: '24px', top: '24px', position: 'absolute' }}>
          <div style={{ width: '1288px', height: '34px', left: '0px', top: '48px', position: 'absolute' }}>
            <div style={{ width: '205px', height: '34px', left: '195.31px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
              <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 편집 및 샘플 문서 등록</div>
            </div>
            <div style={{ left: '408px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
            <div style={{ width: '254px', height: '34px', left: '418px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
              <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>미분류 문서 카테고리 자동 생성 여부 선택</div>
            </div>
            <div style={{ left: '680px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
            <div style={{ width: '178px', height: '34px', left: '690px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
              <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 및 문서 분류</div>
            </div>
            <div style={{ left: '876px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
            <div style={{ width: '166px', height: '34px', left: '886px', top: '0px', position: 'absolute', borderRadius: '4px', border: '1px #DDDDDD solid' }}>
              <div style={{ left: '17px', top: '9px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 전문가 DB 생성</div>
            </div>
            <div style={{ left: '1060px', top: '11px', position: 'absolute', color: '#666666', fontSize: '12px' }}>›</div>
            <div style={{ width: '136px', height: '32px', left: '1070px', top: '1px', position: 'absolute', background: '#5A6F95', borderRadius: '4px' }}>
              <div style={{ left: '16px', top: '8px', position: 'absolute', color: 'white', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word' }}>카테고리 생성 완료</div>
            </div>
          </div>
          <div style={{ width: '1288px', height: '379px', left: '0px', top: '124px', position: 'absolute' }}>
            <div style={{ width: '120px', height: '100px', left: '584px', top: '0px', position: 'absolute', overflow: 'hidden' }}>
              <div style={{ width: '120px', height: '100px', left: '0px', top: '0px', position: 'absolute', background: '#DAE8FC' }}></div>
              <div style={{ width: '74.94px', height: '7.23px', left: '22.53px', top: '46.38px', position: 'absolute', background: 'black' }}></div>
            </div>
            <div style={{ width: '400px', height: '120px', left: '444px', top: '182px', position: 'absolute', outline: '1px #DDDDDD solid', outlineOffset: '-1px' }}>
              <div style={{ width: '399px', height: '153px', left: '0.50px', top: '0.50px', position: 'absolute' }}>
                <div style={{ width: '399px', height: '34px', left: '0px', top: '0px', position: 'absolute', borderBottom: '1px #DDDDDD solid' }}>
                  <div style={{ width: '199.50px', height: '34px', left: '0px', top: '0px', position: 'absolute', background: '#F9F9F9' }}>
                    <div style={{ left: '57.48px', top: '9.50px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', wordWrap: 'break-word' }}>수동 생성한 카테고리 수</div>
                  </div>
                  <div style={{ left: '211.50px', top: '9.50px', position: 'absolute', color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', wordWrap: 'break-word' }}>6개</div>
                </div>
                <div style={{ width: '399px', height: '34px', left: '0px', top: '34px', position: 'absolute', borderBottom: '1px #DDDDDD solid' }}>
                  <div style={{ width: '199.50px', height: '34px', left: '0px', top: '0px', position: 'absolute', background: '#F9F9F9' }}>
                    <div style={{ left: '57.48px', top: '9.50px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', wordWrap: 'break-word' }}>자동 생성된 카테고리 수</div>
                  </div>
                  <div style={{ left: '211.50px', top: '9.50px', position: 'absolute', color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', wordWrap: 'break-word' }}>6개</div>
                </div>
                <div style={{ width: '399px', height: '51px', left: '0px', top: '68px', position: 'absolute', borderBottom: '1px #DDDDDD solid' }}>
                  <div style={{ width: '199.50px', height: '51px', left: '0px', top: '0px', position: 'absolute', background: '#F9F9F9' }}>
                    <div style={{ width: '171px', height: '32px', left: '55.50px', top: '14.50px', position: 'absolute', color: '#333333', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '600', wordWrap: 'break-word' }}>문서 카테고리 분류율</div>
                  </div>
                  <div style={{ left: '211.50px', top: '18px', position: 'absolute', color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', wordWrap: 'break-word' }}>26.08%(125122건/479760건)</div>
                </div>
              </div>
            </div>
            <div
              onClick={onConfirm}
              style={{ width: '74px', height: '28px', left: '607px', top: '351px', position: 'absolute', background: 'white', borderRadius: '4px', outline: '1px #DDDDDD solid', outlineOffset: '-1px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ color: '#666666', fontSize: '12px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '18px', wordWrap: 'break-word' }}>확인</div>
            </div>
            <div style={{ left: '543px', top: '130px', position: 'absolute', color: '#333333', fontSize: '14px', fontFamily: 'Roboto', fontWeight: '400', lineHeight: '21px', wordWrap: 'break-word' }}>카테고리 생성이 완료되었습니다.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
