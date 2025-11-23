import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

interface ItemData {
  item_name: string;
  amount: number;
  budget: number;
  utilization: number;
  category?: string;
  committee?: string;
}

interface ItemWiseExpenseChartProps {
  data: ItemData[];
  allCategories: string[];
  allCommittees: string[];
  onCategoryChange: (category: string) => void;
  onCommitteeChange: (committee: string) => void;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function ItemWiseExpenseChart({ 
  data, 
  allCategories, 
  allCommittees,
  onCategoryChange,
  onCommitteeChange 
}: ItemWiseExpenseChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCommittee, setSelectedCommittee] = useState<string>('all');

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    onCategoryChange(value);
  };

  const handleCommitteeChange = (value: string) => {
    setSelectedCommittee(value);
    onCommitteeChange(value);
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
          <p className="font-semibold mb-3 text-sm">{data.item_name}</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Amount Spent:</span>
              <span className="font-semibold">{formatCurrency(data.amount)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">Budget Utilization:</span>
              <span className={`font-semibold ${
                data.utilization > 100 ? 'text-destructive' : 
                data.utilization > 80 ? 'text-warning' : 'text-success'
              }`}>
                {data.utilization.toFixed(1)}%
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-border text-xs text-muted-foreground">
              {data.utilization > 100 
                ? '⚠ Over budget' 
                : data.utilization > 80 
                ? '⚡ Near limit' 
                : '✓ Within budget'}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const getBarColor = (utilization: number) => {
    if (utilization > 100) return 'hsl(var(--destructive))';
    if (utilization > 80) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-base font-normal">Top 10 Items by Spending</CardTitle>
          <CardDescription className="text-xs mt-1">
            Shows the highest spending items with their budget utilization. Colors indicate: 
            <span className="text-success"> Green (&lt;80%)</span>, 
            <span className="text-warning"> Yellow (80-100%)</span>, 
            <span className="text-destructive"> Red (&gt;100%)</span>
          </CardDescription>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCommittee} onValueChange={handleCommitteeChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by Committee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Committees</SelectItem>
              {allCommittees.map(comm => (
                <SelectItem key={comm} value={comm}>{comm}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px]">
            <ResponsiveContainer width="100%" height={600}>
              <BarChart 
                data={data} 
                layout="vertical"
                margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number"
                  tickFormatter={formatCompactCurrency}
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  type="category"
                  dataKey="item_name" 
                  width={140}
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  interval={0}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="amount" 
                  name="Spent"
                  radius={[0, 6, 6, 0]}
                  barSize={35}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.utilization)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <p className="text-xs font-medium mb-3">Budget Utilization Legend:</p>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success"></div>
              <span className="text-muted-foreground">&lt;80% - Healthy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-warning"></div>
              <span className="text-muted-foreground">80-100% - Near Limit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive"></div>
              <span className="text-muted-foreground">&gt;100% - Over Budget</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
