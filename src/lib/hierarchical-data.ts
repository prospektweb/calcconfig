import { MultiLevelItem } from '@/components/calculator/MultiLevelSelect'

export const operationsHierarchy: MultiLevelItem[] = [
  {
    id: 'operations',
    label: 'Операции',
    children: [
      {
        id: 'print',
        label: 'Печать',
        children: [
          { id: 'print-digital', label: 'Цифровая печать', value: '338' },
          { id: 'print-offset', label: 'Офсетная печать', value: '339' },
          { id: 'print-uv', label: 'УФ-печать', value: '340' },
          { id: 'print-ecosolvent', label: 'Экосольветная печать', value: '341' },
        ]
      },
      {
        id: 'postpress',
        label: 'Постпечатные работы',
        children: [
          {
            id: 'cutting',
            label: 'Резка',
            children: [
              { id: 'cutting-plotter', label: 'Плоттерная резка', value: '350' },
              { id: 'cutting-guillotine', label: 'Гильотинная резка', value: '351' },
              { id: 'cutting-manual', label: 'Ручная резка', value: '352' },
            ]
          },
          {
            id: 'lamination',
            label: 'Ламинирование',
            children: [
              { id: 'lam-matte', label: 'Ламинирование матовое', value: '357' },
              { id: 'lam-gloss', label: 'Ламинирование глянцевое', value: '358' },
            ]
          }
        ]
      }
    ]
  }
]

export const materialsHierarchy: MultiLevelItem[] = [
  {
    id: 'materials',
    label: 'Материалы',
    children: [
      {
        id: 'paper',
        label: 'Бумага',
        children: [
          {
            id: 'paper-coated',
            label: 'Мелованная бумага',
            children: [
              {
                id: 'paper-coated-matte',
                label: 'Матовая бумага',
                children: [
                  { id: 'paper-coated-matte-300', label: 'Мелованная матовая бумага 300 г/м²', value: '325' },
                  { id: 'paper-coated-matte-200', label: 'Мелованная матовая бумага 200 г/м²', value: '326' },
                  { id: 'paper-coated-matte-115', label: 'Мелованная матовая бумага 115 г/м²', value: '327' },
                ]
              },
              {
                id: 'paper-coated-gloss',
                label: 'Глянцевая бумага',
                children: [
                  { id: 'paper-coated-gloss-300', label: 'Мелованная глянцевая бумага 300 г/м²', value: '328' },
                  { id: 'paper-coated-gloss-200', label: 'Мелованная глянцевая бумага 200 г/м²', value: '329' },
                ]
              }
            ]
          },
          {
            id: 'paper-cardboard',
            label: 'Картон',
            children: [
              { id: 'cardboard-400', label: 'Картон 400 г/м²', value: '330' },
              { id: 'cardboard-300', label: 'Картон 300 г/м²', value: '331' },
            ]
          }
        ]
      },
      {
        id: 'film',
        label: 'Плёнка',
        children: [
          {
            id: 'film-matte',
            label: 'Матовая',
            children: [
              { id: 'film-matte-white-80', label: 'Белая матовая плёнка 80 мкм', value: '454' },
              { id: 'film-matte-white-50', label: 'Белая матовая плёнка 50 мкм', value: '455' },
            ]
          },
          {
            id: 'film-gloss',
            label: 'Глянцевая',
            children: [
              { id: 'film-gloss-clear-80', label: 'Прозрачная глянцевая плёнка 80 мкм', value: '456' },
              { id: 'film-gloss-white-80', label: 'Белая глянцевая плёнка 80 мкм', value: '457' },
            ]
          }
        ]
      }
    ]
  }
]
