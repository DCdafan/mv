import { useEffect, useState } from 'react'
import { Plus, Layers, Building2, Copy, Trash2, Film, Sparkles, LayoutTemplate } from 'lucide-react'
import { useApp } from '../store/app'
import { thumbUrl, fmtTime, Modal, Switch } from './common'
import { getTemplate, TEMPLATES } from '../templates'
import { templateThumb, DEMO_PHOTOS } from './preview'

function timeAgo(t: number): string {
  const d = (Date.now() - t) / 1000
  if (d < 60) return '刚刚'
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`
  if (d < 86400 * 30) return `${Math.floor(d / 86400)} 天前`
  return new Date(t).toLocaleDateString('zh-CN')
}

export function BrandDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { settings, saveSettings, toast } = useApp()
  const [b, setB] = useState(settings!.brand)
  const [outDir, setOutDir] = useState(settings!.outputDir)
  return (
    <Modal
      title={
        <span className="row">
          <Building2 size={17} /> 品牌与偏好设置
        </span>
      }
      width={520}
      onClose={onClose}
      footer={
        <>
          <div className="grow" />
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={async () => {
              await saveSettings({ brand: b, outputDir: outDir })
              toast('设置已保存', 'success')
              onClose()
            }}
          >
            保存
          </button>
        </>
      }
    >
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <b>在 MV 片尾显示店铺信息</b>
          <div className="muted tiny">所有模板的片尾都会自动带上店铺名称、口号、地址和电话</div>
        </div>
        <Switch on={b.enabled} onChange={(v) => setB({ ...b, enabled: v })} />
      </div>
      <div className="field">
        <label>影楼 / 店铺名称</label>
        <input className="input" value={b.studioName} placeholder="例如：拾光摄影工作室、甜心烘焙坊" onChange={(e) => setB({ ...b, studioName: e.target.value })} />
      </div>
      <div className="field">
        <label>口号</label>
        <input className="input" value={b.slogan} placeholder="例如：用心记录每一份幸福" onChange={(e) => setB({ ...b, slogan: e.target.value })} />
      </div>
      <div className="field">
        <label>电话</label>
        <div className="row">
          <select className="select" style={{ width: 130 }} value={b.phoneLabel || '预约热线'} onChange={(e) => setB({ ...b, phoneLabel: e.target.value })}>
            {['预约热线', '订购热线', '联系电话', '外卖热线'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input className="input" value={b.phone} placeholder="例如：400-000-0000" onChange={(e) => setB({ ...b, phone: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>门店地址</label>
        <input className="input" value={b.address ?? ''} placeholder="例如：XX 路 88 号（选填）" onChange={(e) => setB({ ...b, address: e.target.value })} />
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="grow">
          <b>画面右下角水印</b>
          <div className="muted tiny">全程显示店铺名称（半透明）</div>
        </div>
        <Switch on={b.watermark} onChange={(v) => setB({ ...b, watermark: v })} />
      </div>
      <div className="divider" />
      <div className="field">
        <label>默认导出文件夹</label>
        <div className="row">
          <input className="input" value={outDir} readOnly />
          <button
            className="btn"
            onClick={async () => {
              const d = await window.mv.openFolder('选择默认导出文件夹')
              if (d) setOutDir(d)
            }}
          >
            更改
          </button>
        </div>
      </div>
    </Modal>
  )
}

function HeroArt(): JSX.Element {
  const [imgs, setImgs] = useState<string[]>([])
  useEffect(() => {
    Promise.all(['wedding-white', 'bakery-sweet', 'chinese-red'].map((id) => templateThumb(id, DEMO_PHOTOS, '9:16', 'scene'))).then(setImgs)
  }, [])
  return (
    <div className="hero-art">
      {imgs.map((u, i) => (
        <div key={i} className="card" style={{ backgroundImage: `url(${u})`, backgroundSize: 'cover', transform: `translateY(${i === 1 ? -14 : 0}px)` }} />
      ))}
    </div>
  )
}

export function Home(): JSX.Element {
  const { projects, openProject, refreshProjects, setWizardOpen, setView, toast, setShowExports, exports } = useApp()
  const [brand, setBrand] = useState(false)
  const active = exports.filter((j) => j.status === 'rendering' || j.status === 'queued' || j.status === 'muxing').length
  return (
    <>
      <div className="topbar drag">
        <div className="brand">
          <div className="logo">
            <Sparkles size={15} />
          </div>
          拾光MV
        </div>
        <span className="muted small">影楼写真 · 蛋糕烘焙门店 · 一键卡点成片</span>
        <div className="grow" />
        <button className="btn sm no-drag" onClick={() => setShowExports(true)}>
          <Film size={14} /> 导出队列{active ? ` (${active})` : ''}
        </button>
        <button className="btn sm no-drag" onClick={() => setBrand(true)}>
          <Building2 size={14} /> 品牌设置
        </button>
      </div>
      <div className="home">
        <div className="hero">
          <div style={{ maxWidth: 560 }}>
            <h1>导入照片，一键生成卡点 MV</h1>
            <p>
              影楼客片、蛋糕甜品新品都能做：自动识别人脸与模糊、闭眼、重复照片，
              从文件名识别品名和价格，按音乐节拍编排版式与转场。
              <br />
              {TEMPLATES.length} 套精选模板 · 26 种转场 · 横竖屏一键切换 · 4K 硬件加速导出
            </p>
            <div className="row">
              <button className="btn primary lg" onClick={() => setWizardOpen(true)}>
                <Plus size={18} /> 新建 MV
              </button>
              <button className="btn lg" onClick={() => setView('batch')}>
                <Layers size={17} /> 批量出片
              </button>
            </div>
          </div>
          <HeroArt />
        </div>

        <div className="quick">
          <div className="quick-item" onClick={() => setWizardOpen(true)}>
            <div className="ic">
              <Sparkles size={20} />
            </div>
            <div>
              <b>智能成片</b>
              <span className="muted small">导入 → 选模板 → 选音乐，三步出片</span>
            </div>
          </div>
          <div className="quick-item" onClick={() => setView('batch')}>
            <div className="ic">
              <Layers size={20} />
            </div>
            <div>
              <b>批量出片</b>
              <span className="muted small">一个文件夹一个客户，排队自动导出</span>
            </div>
          </div>
          <div className="quick-item" onClick={() => setBrand(true)}>
            <div className="ic">
              <Building2 size={20} />
            </div>
            <div>
              <b>店铺品牌</b>
              <span className="muted small">片尾店名、地址、电话与水印</span>
            </div>
          </div>
        </div>

        <div className="section-title">
          <LayoutTemplate size={17} /> 最近项目 <span className="muted small">{projects.length} 个</span>
        </div>
        {projects.length === 0 ? (
          <div className="empty">还没有项目，点击「新建 MV」开始吧</div>
        ) : (
          <div className="proj-grid">
            {projects.map((p) => (
              <div key={p.id} className="proj" onClick={() => openProject(p.id)}>
                <div className="cover" style={{ backgroundImage: thumbUrl(p.cover) }} />
                <div className="meta">
                  <div className="name">{p.name}</div>
                  <div className="row tiny muted">
                    <span>{getTemplate(p.templateId).name}</span>
                    <span>·</span>
                    <span>{p.photoCount} 张</span>
                    <span>·</span>
                    <span>{fmtTime(p.duration)}</span>
                    <div className="grow" />
                    <span>{timeAgo(p.updatedAt)}</span>
                  </div>
                </div>
                <div className="ops">
                  <button
                    className="btn sm icon"
                    title="复制"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await window.mv.duplicateProject(p.id)
                      refreshProjects()
                    }}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    className="btn sm icon danger"
                    title="删除"
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (!confirm(`确定删除项目「${p.name}」？（不会删除原始照片）`)) return
                      await window.mv.deleteProject(p.id)
                      refreshProjects()
                      toast('已删除')
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {brand && <BrandDialog onClose={() => setBrand(false)} />}
    </>
  )
}
