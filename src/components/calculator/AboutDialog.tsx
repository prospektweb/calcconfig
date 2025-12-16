import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

interface AboutDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95rem] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">О программе - Калькулятор печатных изделий</DialogTitle>
          <DialogDescription>
            Подробное техническое описание функциональности приложения
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🎯 Назначение приложения
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Калькулятор печатных изделий представляет собой сложное веб-приложение для расчёта себестоимости и отпускных цен печатной продукции. 
                Приложение использует React 19.2.0, TypeScript 5.7.3, Tailwind CSS 4.1.17 и shadcn/ui компоненты v4. 
                Архитектура построена на функциональных компонентах с хуками, обеспечивая реактивное управление состоянием.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🗂️ Управление деталями и скреплениями
              </h3>
              
              <div className="space-y-3">
                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-medium mb-2">Детали (Detail)</h4>
                  <p className="text-muted-foreground mb-2">
                    Базовая единица калькуляции, представляющая отдельный печатный лист или элемент изделия.
                  </p>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                    <div><Badge variant="outline">Структура</Badge></div>
                    <div>interface Detail {'{'}</div>
                    <div className="pl-4">id: string; // Уникальный идентификатор ULID</div>
                    <div className="pl-4">name: string; // Название детали</div>
                    <div className="pl-4">width: number; // Ширина в мм</div>
                    <div className="pl-4">length: number; // Длина в мм</div>
                    <div className="pl-4">quantity: number; // Тираж</div>
                    <div className="pl-4">isExpanded: boolean; // Состояние раскрытия</div>
                    <div>{'}'}</div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    <strong>Создание:</strong> Функция <code className="bg-muted px-1 rounded">createEmptyDetail()</code> генерирует новую деталь с уникальным ID через библиотеку ULID. 
                    Обработчик <code className="bg-muted px-1 rounded">handleAddDetail()</code> добавляет деталь в массив через <code className="bg-muted px-1 rounded">setDetails(prev =&gt; [...prev, newDetail])</code>.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    <strong>Обновление:</strong> Функция <code className="bg-muted px-1 rounded">handleUpdateDetail(detailId, updates)</code> использует immutable паттерн: 
                    <code className="bg-muted px-1 rounded">setDetails(prev =&gt; prev.map(d =&gt; d.id === detailId ? {'{'} ...d, ...updates {'}'} : d))</code>.
                    Каждое изменение отправляет PostMessage событие 'DETAIL_UPDATED' в родительское окно.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    <strong>Drag & Drop:</strong> Компонент использует кастомный хук <code className="bg-muted px-1 rounded">useCustomDrag()</code>. 
                    При захвате мышью (mousedown на иконку) вызывается <code className="bg-muted px-1 rounded">handleDetailDragStart()</code>, 
                    который сохраняет начальную позицию, размеры элемента и создаёт виртуальный clone для визуализации перетаскивания.
                  </p>
                </div>

                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-medium mb-2">Скрепления (Binding)</h4>
                  <p className="text-muted-foreground mb-2">
                    Композитная структура, объединяющая несколько деталей и/или других скреплений. Поддерживает вложенность.
                  </p>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                    <div><Badge variant="outline">Структура</Badge></div>
                    <div>interface Binding {'{'}</div>
                    <div className="pl-4">id: string;</div>
                    <div className="pl-4">name: string;</div>
                    <div className="pl-4">detailIds: string[]; // ID входящих деталей</div>
                    <div className="pl-4">bindingIds: string[]; // ID вложенных скреплений</div>
                    <div className="pl-4">material?: MaterialInfo;</div>
                    <div className="pl-4">operation?: OperationInfo;</div>
                    <div className="pl-4">equipment?: EquipmentInfo;</div>
                    <div className="pl-4">isExpanded: boolean;</div>
                    <div>{'}'}</div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    <strong>Создание между элементами:</strong> При нажатии на кнопку <code className="bg-muted px-1 rounded">&lt;LinkIcon /&gt;</code> между двумя соседними элементами, 
                    вызывается <code className="bg-muted px-1 rounded">handleCreateBinding(index)</code>. Функция берёт элементы по индексу и index+1, 
                    создаёт новое скрепление и автоматически добавляет их ID в соответствующие массивы detailIds или bindingIds.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    <strong>Рекурсивный рендеринг:</strong> Компонент <code className="bg-muted px-1 rounded">BindingCard</code> рекурсивно отображает вложенные структуры. 
                    Для каждого детального ID загружается полный объект детали из массива, для каждого binding ID - рекурсивно рендерится вложенный BindingCard.
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                📋 Шапка приложения и вкладки
              </h3>
              <p className="text-muted-foreground mb-3">
                Компонент <code className="bg-muted px-1 rounded">HeaderSection</code> содержит четыре вкладки: Материалы, Операции, Оборудование, Детали. 
                Состояние активной вкладки управляется через <code className="bg-muted px-1 rounded">useState&lt;string&gt;('details')</code>.
              </p>
              <div className="bg-muted/50 p-3 rounded space-y-2">
                <p className="font-mono text-xs">
                  <Badge variant="secondary">Материалы</Badge> Отображает список доступных материалов с возможностью drag&drop в скрепления. 
                  При перетаскивании создаётся DataTransfer объект с типом 'application/json' и payload содержащим materialId и materialName.
                </p>
                <p className="font-mono text-xs">
                  <Badge variant="secondary">Операции</Badge> Список производственных операций (например, печать, резка, биговка). 
                  Реализован аналогичный механизм drag&drop для привязки операций к скреплениям через <code className="bg-muted px-1 rounded">onDragStart</code> событие.
                </p>
                <p className="font-mono text-xs">
                  <Badge variant="secondary">Оборудование</Badge> Каталог производственного оборудования. 
                  Использует тот же паттерн drag&drop с событием onDragEnd для сброса визуального состояния перетаскивания.
                </p>
                <p className="font-mono text-xs">
                  <Badge variant="secondary">Детали</Badge> Каталог типовых деталей из <code className="bg-muted px-1 rounded">mockDetails</code>. 
                  При перетаскивании в основную область вызывается <code className="bg-muted px-1 rounded">handleMainAreaDrop()</code>, 
                  который парсит JSON, находит деталь по ID и создаёт новый экземпляр через <code className="bg-muted px-1 rounded">createEmptyDetail()</code> с предзаполненными размерами.
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🔄 Drag & Drop система
              </h3>
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Приложение использует два типа drag&drop: нативный HTML5 для элементов шапки и кастомный для переупорядочивания деталей/скреплений.
                </p>
                
                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-medium mb-2">Кастомный Drag (useCustomDrag hook)</h4>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                    <div>const dragState = {'{'}</div>
                    <div className="pl-4">isDragging: boolean,</div>
                    <div className="pl-4">draggedItemId: string | null,</div>
                    <div className="pl-4">draggedItemType: 'detail' | 'binding' | null,</div>
                    <div className="pl-4">dropTargetIndex: number | null,</div>
                    <div className="pl-4">dragPosition: {'{'} x: number, y: number {'}'},</div>
                    <div className="pl-4">initialPosition: {'{'} x, y, width, height {'}'}</div>
                    <div>{'}'}</div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    <strong>Механизм работы:</strong> При mousedown на иконку <code className="bg-muted px-1 rounded">&lt;DotsSixVertical /&gt;</code>, 
                    вызывается <code className="bg-muted px-1 rounded">startDrag()</code>, сохраняющий элемент, его размеры и начальные координаты. 
                    Эффект с mousemove отслеживает позицию курсора, обновляя dragPosition через <code className="bg-muted px-1 rounded">setDragPosition({'{'} x: e.clientX, y: e.clientY {'}'})</code>. 
                    Оригинальный элемент скрывается (return null в условии), вместо него рендерится ghost-копия в fixed позиции.
                  </p>
                  <p className="text-muted-foreground mt-2">
                    <strong>Drop zones:</strong> Между всеми элементами рендерятся drop zone индикаторы. 
                    useEffect с mousemove вычисляет ближайшую зону через <code className="bg-muted px-1 rounded">Math.abs(e.clientY - centerY)</code>, 
                    обновляя <code className="bg-muted px-1 rounded">dropTargetIndex</code>. При mouseup вызывается <code className="bg-muted px-1 rounded">reorderItems(fromIndex, toIndex)</code>.
                  </p>
                </div>

                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-medium mb-2">Reorder Algorithm</h4>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                    <div>const reorderItems = (fromIndex, toIndex) =&gt; {'{'}</div>
                    <div className="pl-4">const allItems = getAllItemsInOrder();</div>
                    <div className="pl-4">const reorderedItems = [...allItems];</div>
                    <div className="pl-4">const [movedItem] = reorderedItems.splice(fromIndex, 1);</div>
                    <div className="pl-4">const adjustedToIndex = fromIndex &lt; toIndex</div>
                    <div className="pl-6">? toIndex - 1 : toIndex;</div>
                    <div className="pl-4">reorderedItems.splice(adjustedToIndex, 0, movedItem);</div>
                    <div className="pl-4">// Разделение на details и bindings массивы</div>
                    <div className="pl-4">setDetails(newDetails);</div>
                    <div className="pl-4">setBindings(newBindings);</div>
                    <div>{'}'}</div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    Функция <code className="bg-muted px-1 rounded">getAllItemsInOrder()</code> объединяет детали и скрепления верхнего уровня 
                    (не входящие в другие скрепления) в единый массив для корректного визуального порядка и drag&drop операций.
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                📊 Расчётные панели
              </h3>
              
              <div className="space-y-3">
                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-medium mb-2">Габариты/Вес (GabVesPanel)</h4>
                  <p className="text-muted-foreground mb-2">
                    Активируется кнопкой в footer. Состояние управляется через <code className="bg-muted px-1 rounded">isGabVesActive</code> и <code className="bg-muted px-1 rounded">isGabVesPanelExpanded</code>.
                  </p>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs">
                    <div>const handleToggleGabVes = () =&gt; {'{'}</div>
                    <div className="pl-4">setIsGabVesActive(!isGabVesActive);</div>
                    <div className="pl-4">if (!isGabVesActive) {'{'}</div>
                    <div className="pl-6">setIsGabVesPanelExpanded(true);</div>
                    <div className="pl-6">addGabVesMessage('Расчёт габаритов начат...');</div>
                    <div className="pl-6">setTimeout(() =&gt; {'{'}</div>
                    <div className="pl-8">addGabVesMessage('Ширина: 297мм, Длина: 420мм');</div>
                    <div className="pl-6">{'}'}, 500);</div>
                    <div className="pl-4">{'}'}</div>
                    <div>{'}'}</div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    Панель показывает историю сообщений расчёта. Каждое сообщение имеет timestamp и уникальный ID <code className="bg-muted px-1 rounded">gabves_${'{'}{Date.now()}{'}'}</code>.
                  </p>
                </div>

                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-medium mb-2">Себестоимость (CostPanel)</h4>
                  <p className="text-muted-foreground mb-2">
                    Расширенная панель с настройками калькуляции. Сохраняет конфигурацию через <code className="bg-muted px-1 rounded">useConfigKV&lt;CostingSettings&gt;('calc_costing_settings')</code>.
                  </p>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                    <div>interface CostingSettings {'{'}</div>
                    <div className="pl-4">basedOn: 'COMPONENT_PURCHASE' | 'COMPONENT_COST' | 'DETAIL_COST';</div>
                    <div className="pl-4">roundingStep: number; // Шаг округления</div>
                    <div className="pl-4">markupValue: number; // Значение наценки</div>
                    <div className="pl-4">markupUnit: 'RUB' | 'PERCENT'; // Рубли или проценты</div>
                    <div>{'}'}</div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    Панель включает выпадающие списки для выбора базы расчёта, инпуты для наценки и шага округления. 
                    Все изменения автоматически синхронизируются через <code className="bg-muted px-1 rounded">setCostingSettings()</code>, 
                    который использует KV-хранилище для персистентности между сессиями.
                  </p>
                </div>

                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-medium mb-2">Отпускные цены (PricePanel)</h4>
                  <p className="text-muted-foreground mb-2">
                    Управление ценовыми типами через мультиселект. Использует <code className="bg-muted px-1 rounded">MultiLevelSelect</code> компонент.
                  </p>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                    <div>interface SalePricesSettings {'{'}</div>
                    <div className="pl-4">selectedTypes: string[]; // ID выбранных типов цен</div>
                    <div className="pl-4">types: Record&lt;string, {'{'}</div>
                    <div className="pl-6">name: string;</div>
                    <div className="pl-6">markup: number;</div>
                    <div className="pl-6">unit: 'RUB' | 'PERCENT';</div>
                    <div className="pl-4">{'}'}{'}'}</div>
                    <div>{'}'}</div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    Компонент позволяет создавать несколько типов цен с индивидуальными наценками. 
                    При расчёте система применяет наценку к себестоимости для каждого выбранного типа.
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🔗 PostMessage Bridge
              </h3>
              <p className="text-muted-foreground mb-3">
                Приложение использует кастомный хук <code className="bg-muted px-1 rounded">usePostMessage()</code> для двунаправленной коммуникации с родительским окном.
              </p>
              <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                <div>const {'{'} syncState, sendMessage, subscribe {'}'} = usePostMessage({'{'}</div>
                <div className="pl-4">onStateRequest: getCurrentState,</div>
                <div className="pl-4">onStateResponse: handleStateResponse,</div>
                <div className="pl-4">syncDelay: 500, // Debounce delay</div>
                <div>{'}'})</div>
              </div>
              <p className="text-muted-foreground mt-2">
                <strong>Исходящие события:</strong> DETAIL_ADDED, DETAIL_UPDATED, DETAIL_DELETED, BINDING_CREATED, BINDING_UPDATED, 
                CALCULATION_START, CALCULATION_PROGRESS, CALCULATION_COMPLETE. Каждое событие отправляется через 
                <code className="bg-muted px-1 rounded">window.parent.postMessage()</code> с типизированным payload.
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Входящие события:</strong> STATE_REQUEST вызывает <code className="bg-muted px-1 rounded">getCurrentState()</code>, 
                возвращающий актуальный snapshot состояния. STATE_RESPONSE загружает полученное состояние через 
                <code className="bg-muted px-1 rounded">handleStateResponse()</code>, обновляя все useConfigKV хуки.
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Синхронизация:</strong> useEffect отслеживает изменения критических полей (details, bindings, headerTabs) 
                и вызывает <code className="bg-muted px-1 rounded">syncState()</code> с debounce 500ms для избежания частых обновлений.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                💾 Персистентность данных
              </h3>
              <p className="text-muted-foreground mb-3">
                Приложение использует локальный хук <code className="bg-muted px-1 rounded">useConfigKV</code> из <code className="bg-muted px-1 rounded">@/hooks/use-config-kv</code> для реактивного key-value хранилища на базе localStorage и BitrixConfigStore.
              </p>
              <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                <div>const [details, setDetails, deleteDetails] = </div>
                <div className="pl-4">useConfigKV&lt;Detail[]&gt;('calc_details', []);</div>
                <div className="mt-2">const [costingSettings, setCostingSettings] = </div>
                <div className="pl-4">useConfigKV&lt;CostingSettings&gt;('calc_costing_settings', defaultSettings);</div>
              </div>
              <p className="text-muted-foreground mt-2">
                <strong>Критически важно:</strong> Всегда используются функциональные обновления для избежания stale closure проблем:
                <code className="bg-muted px-1 rounded">setDetails(currentDetails =&gt; [...currentDetails, newDetail])</code> вместо 
                <code className="bg-muted px-1 rounded">setDetails([...details, newDetail])</code>.
              </p>
              <p className="text-muted-foreground mt-2">
                Ключи хранилища: 'calc_details', 'calc_bindings', 'calc_header_tabs', 'calc_costing_settings', 'calc_sale_prices_settings'. 
                Состояние панели InfoPanel хранится в localStorage как 'calc_info_panel_expanded' для независимого управления.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🧮 Процесс расчёта
              </h3>
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Приложение поддерживает два режима расчёта: тестовый (для одного варианта) и полный (для всех выбранных вариантов).
                </p>
                <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                  <div>const handleTestCalculation = async () =&gt; {'{'}</div>
                  <div className="pl-4">setIsCalculating(true);</div>
                  <div className="pl-4">setCalculationProgress(0);</div>
                  <div className="pl-4">addInfoMessage('info', 'Запущен тестовый расчёт...');</div>
                  <div className="pl-4">sendMessage('CALCULATION_START', {'{'} type: 'test' {'}'});</div>
                  <div className="pl-4">for (let i = 0; i &lt;= 100; i += 10) {'{'}</div>
                  <div className="pl-6">await new Promise(resolve =&gt; setTimeout(resolve, 200));</div>
                  <div className="pl-6">setCalculationProgress(i);</div>
                  <div className="pl-6">sendMessage('CALCULATION_PROGRESS', {'{'} progress: i {'}'});</div>
                  <div className="pl-4">{'}'}</div>
                  <div className="pl-4">setIsCalculating(false);</div>
                  <div className="pl-4">toast.success('Расчёт завершён успешно');</div>
                  <div>{'}'}</div>
                </div>
                <p className="text-muted-foreground mt-2">
                  Во время расчёта отображается <code className="bg-muted px-1 rounded">&lt;Progress /&gt;</code> компонент в верхней части footer. 
                  Кнопки расчёта блокируются через <code className="bg-muted px-1 rounded">disabled={'{'}isCalculating{'}'}</code> атрибут.
                  Результаты отправляются через PostMessage событие CALCULATION_COMPLETE с payload содержащим финальную себестоимость.
                </p>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                📱 Footer и варианты
              </h3>
              <p className="text-muted-foreground mb-3">
                Компонент <code className="bg-muted px-1 rounded">VariantsFooter</code> управляет выбором вариантов продукции для расчёта.
              </p>
              <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                <div>const [selectedVariantIds] = useState&lt;number[]&gt;(</div>
                <div className="pl-4">Array.from({'{'} length: 15 {'}'}, (_, i) =&gt; 525 + i)</div>
                <div>);</div>
                <div>const [testVariantId, setTestVariantId] = useState&lt;number | null&gt;(525);</div>
              </div>
              <p className="text-muted-foreground mt-2">
                По умолчанию выбраны 15 вариантов (ID с 525 по 539). Тестовый вариант устанавливается отдельно для быстрой проверки расчётов. 
                Footer содержит кнопки: "Габариты/Вес", "Себестоимость", "Отпускные цены", "Тест", "Рассчитать", "Сохранить", "Закрыть".
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                ℹ️ Информационная панель
              </h3>
              <p className="text-muted-foreground mb-3">
                Компонент <code className="bg-muted px-1 rounded">InfoPanel</code> отображает лог всех событий в приложении.
              </p>
              <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                <div>interface InfoMessage {'{'}</div>
                <div className="pl-4">id: string;</div>
                <div className="pl-4">type: 'info' | 'success' | 'warning' | 'error';</div>
                <div className="pl-4">message: string;</div>
                <div className="pl-4">timestamp: number;</div>
                <div>{'}'}</div>
              </div>
              <p className="text-muted-foreground mt-2">
                Сообщения добавляются через <code className="bg-muted px-1 rounded">addInfoMessage(type, message)</code>, 
                который создаёт новый объект с уникальным ID и текущим timestamp. Панель раскрывается/скрывается кликом на заголовок, 
                состояние сохраняется в localStorage.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🎨 Стилизация и тема
              </h3>
              <p className="text-muted-foreground mb-3">
                Приложение использует Tailwind CSS v4 с кастомной цветовой схемой в OKLCH пространстве для улучшенной перцептивной однородности.
              </p>
              <div className="bg-muted/50 p-3 rounded font-mono text-xs space-y-1">
                <div>:root {'{'}</div>
                <div className="pl-4">--background: oklch(1 0 0); // Белый фон</div>
                <div className="pl-4">--foreground: oklch(0.25 0 0); // Тёмный текст</div>
                <div className="pl-4">--accent: oklch(0.55 0.15 250); // Синий акцент</div>
                <div className="pl-4">--border: oklch(0.85 0 0); // Светло-серые границы</div>
                <div className="pl-4">--radius: 0.375rem; // Радиус скругления</div>
                <div>{'}'}</div>
              </div>
              <p className="text-muted-foreground mt-2">
                Используются Google Fonts: Inter (400, 500, 600) для UI текста и JetBrains Mono (400) для моноширинного кода. 
                Шрифты загружаются через <code className="bg-muted px-1 rounded">&lt;link&gt;</code> в index.html для оптимальной производительности.
              </p>
              <p className="text-muted-foreground mt-2">
                Компоненты shadcn v4 используют CSS переменные для theme-aware стилизации: 
                <code className="bg-muted px-1 rounded">bg-primary text-primary-foreground</code>, 
                <code className="bg-muted px-1 rounded">bg-accent text-accent-foreground</code>. 
                Все интерактивные элементы имеют transition классы для плавных анимаций.
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🔧 Технический стек
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border rounded p-3">
                  <Badge className="mb-2">Frontend</Badge>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• React 19.2.0</li>
                    <li>• TypeScript 5.7.3</li>
                    <li>• Vite 7.2.6</li>
                    <li>• Tailwind CSS 4.1.17</li>
                  </ul>
                </div>
                <div className="border rounded p-3">
                  <Badge className="mb-2">UI Components</Badge>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• shadcn/ui v4</li>
                    <li>• Radix UI primitives</li>
                    <li>• Phosphor Icons 2.1.10</li>
                    <li>• Framer Motion 12.23.25</li>
                  </ul>
                </div>
                <div className="border rounded p-3">
                  <Badge className="mb-2">State Management</Badge>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• React Hooks</li>
                    <li>• useConfigKV (Local)</li>
                    <li>• localStorage</li>
                    <li>• PostMessage API</li>
                  </ul>
                </div>
                <div className="border rounded p-3">
                  <Badge className="mb-2">Utilities</Badge>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• ULID для ID генерации</li>
                    <li>• date-fns для дат</li>
                    <li>• sonner для toast</li>
                    <li>• clsx + tailwind-merge</li>
                  </ul>
                </div>
              </div>
            </section>

            <Separator />

            <section className="pb-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                📝 Ключевые паттерны и best practices
              </h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">✓</span>
                  <span><strong>Immutable updates:</strong> Все state обновления используют spread оператор и функциональные обновления</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">✓</span>
                  <span><strong>Type safety:</strong> Полная типизация TypeScript для всех компонентов, props и состояний</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">✓</span>
                  <span><strong>Composition:</strong> Компоненты разбиты на мелкие переиспользуемые части (DetailCard, BindingCard, InfoPanel)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">✓</span>
                  <span><strong>Custom hooks:</strong> Общая логика вынесена в хуки (useCustomDrag, usePostMessage, useConfigKV)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">✓</span>
                  <span><strong>Event-driven:</strong> PostMessage архитектура для коммуникации с родительским приложением</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">✓</span>
                  <span><strong>Accessibility:</strong> Radix UI обеспечивает ARIA атрибуты, keyboard navigation, focus management</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">✓</span>
                  <span><strong>Performance:</strong> React.memo для DetailCard/BindingCard, debounced PostMessage sync, виртуальный DOM для drag</span>
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
