import { api } from '../api/ordersApi';
import { buildReportHtml } from './reportTemplate';

const STORAGE_KEY = 'report_last_generated';

export const generateOrderReport = async (orderUuid) => {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));

  const response = await api.get(`/orders/${orderUuid}/report`);
  const html = buildReportHtml(response.data);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
};
